# Secrets Management Implementation

This document describes the secrets management implementation for the AI Roadcall Assistant platform.

## Overview

The platform uses AWS Secrets Manager to securely store and manage sensitive credentials including:
- Stripe API keys for payment processing
- Weather API keys for incident context enrichment
- Database credentials (Aurora Postgres) with automatic rotation

## Architecture

### Components

1. **SecretsStack** (`infrastructure/lib/secrets-stack.ts`)
   - Creates and manages secrets in AWS Secrets Manager
   - Configures automatic rotation for database credentials (90-day cycle)
   - Sets up SNS notifications for rotation events
   - Implements CloudWatch alarms for secret access failures

2. **SecretsManagerWrapper** (`packages/aws-clients/src/secrets.ts`)
   - Provides a high-level API for accessing secrets
   - Implements in-memory caching with configurable TTL (default 5 minutes)
   - Handles errors safely without exposing secret values
   - Supports both raw strings and JSON secrets

3. **SecretValue Class** (`packages/utils/src/secret-handler.ts`)
   - Wraps secret values to prevent accidental logging
   - Overrides `toString()`, `toJSON()`, and `valueOf()` methods
   - Provides safe serialization for logging and debugging

## Usage

### Accessing Secrets in Lambda Functions

```typescript
import { secretsManager } from '@roadcall/aws-clients';
import { SecretValue } from '@roadcall/utils';

// Get a JSON secret with SecretValue wrappers
interface StripeSecrets {
  apiKey: SecretValue;
  publishableKey: SecretValue;
}

const secrets = await secretsManager.getSecretJSON<StripeSecrets>(
  'roadcall/stripe/api-key-prod'
);

// Use getValue() only when you need the actual secret
const stripe = new Stripe(secrets.apiKey.getValue());

// Secrets are automatically redacted in logs
logger.info('Initialized Stripe', { secrets }); // Logs: { apiKey: '[SecretValue:...]' }
```

### Caching Behavior

Secrets are cached in memory for 5 minutes by default to reduce API calls and improve performance:

```typescript
// First call - fetches from Secrets Manager
const secret1 = await secretsManager.getSecret('my-secret');

// Second call within 5 minutes - returns from cache
const secret2 = await secretsManager.getSecret('my-secret');

// Disable caching for sensitive operations
const secret3 = await secretsManager.getSecret('my-secret', false);

// Clear cache manually
secretsManager.clearCache('my-secret');
```

### Lambda Cold Start Optimization

Warm up secrets during Lambda initialization to reduce latency:

```typescript
import { warmupSecrets } from '@roadcall/aws-clients';

// Outside handler function
const REQUIRED_SECRETS = [
  'roadcall/stripe/api-key-prod',
  'roadcall/weather/api-key-prod',
];

// Warm up cache during cold start
warmupSecrets(REQUIRED_SECRETS).catch(err => {
  logger.warn('Secret warmup failed', { error: err.message });
});

export const handler = async (event) => {
  // Secrets are already cached
  const secrets = await secretsManager.getSecretJSON('...');
  // ...
};
```

## Secret Rotation

### Database Credentials

Aurora database credentials are automatically rotated every 90 days:

1. Secrets Manager triggers rotation Lambda
2. New credentials are generated
3. Database is updated with new credentials
4. Secret value is updated
5. SNS notification is sent to operations team
6. Lambda functions automatically use new credentials on next invocation

### Manual Secret Updates

To update a secret manually:

```bash
# Update via AWS CLI
aws secretsmanager update-secret \
  --secret-id roadcall/stripe/api-key-prod \
  --secret-string '{"apiKey":"sk_live_...","publishableKey":"pk_live_..."}'

# Or use the AWS Console
# Secrets Manager > Secrets > [Secret Name] > Retrieve secret value > Edit
```

After updating a secret:
1. Clear the cache in running Lambda functions (they will auto-refresh on next invocation)
2. Monitor CloudWatch logs for any authentication failures
3. Verify the rotation notification was sent

## Security Best Practices

### 1. Never Log Secret Values

```typescript
// ❌ BAD - Exposes secret in logs
logger.info('API Key', { apiKey: secret.getValue() });

// ✅ GOOD - Secret is automatically redacted
logger.info('API Key', { apiKey: secret });
```

### 2. Use SecretValue Wrappers

```typescript
// ❌ BAD - Raw string can be accidentally logged
const apiKey: string = await secretsManager.getSecret('...');

// ✅ GOOD - Wrapped in SecretValue
const apiKey: SecretValue = await secretsManager.getSecretValue('...');
```

### 3. Validate Secrets

```typescript
import { validateSecret } from '@roadcall/utils';

const secret = await secretsManager.getSecret('my-secret');

// Throws error if secret is empty or contains placeholder values
validateSecret(secret, 'my-secret');
```

### 4. Handle Errors Safely

```typescript
import { createSafeError } from '@roadcall/utils';

try {
  const secret = await secretsManager.getSecret('my-secret');
} catch (error) {
  // Original error is logged securely, but not exposed to caller
  throw createSafeError('Failed to retrieve secret', error);
}
```

### 5. Use Least-Privilege IAM Policies

Lambda functions should only have access to secrets they need:

```typescript
// In CDK stack
const mySecret = secretsmanager.Secret.fromSecretCompleteArn(
  this,
  'MySecret',
  secretArn
);

// Grant read-only access
mySecret.grantRead(lambdaFunction);
```

## Monitoring and Alerts

### CloudWatch Alarms

1. **Secret Access Failures**
   - Triggers when Lambda functions fail to access secrets
   - Threshold: 5 failures in 1 evaluation period
   - Action: SNS notification to operations team

2. **Secret Rotation Events**
   - Captures all rotation events via EventBridge
   - Sends notification to operations team
   - Includes secret name, timestamp, and rotation status

### Metrics

Monitor secret access patterns:

```typescript
const stats = secretsManager.getCacheStats();
logger.info('Secret cache stats', {
  cacheSize: stats.size,
  cachedSecrets: stats.keys,
});
```

## Deployment

### Initial Setup

1. Deploy the SecretsStack:
```bash
cd infrastructure
pnpm cdk deploy SecretsStack --profile <aws-profile>
```

2. Update placeholder secrets with actual values:
```bash
# Stripe API keys
aws secretsmanager update-secret \
  --secret-id roadcall/stripe/api-key-prod \
  --secret-string '{"apiKey":"sk_live_...","publishableKey":"pk_live_..."}'

# Weather API key
aws secretsmanager update-secret \
  --secret-id roadcall/weather/api-key-prod \
  --secret-string '{"apiKey":"...","endpoint":"https://api.weatherapi.com/v1"}'
```

3. Deploy dependent stacks (PaymentsStack, IncidentStack, etc.)

### Environment-Specific Secrets

Secrets are namespaced by stage:
- `roadcall/stripe/api-key-dev`
- `roadcall/stripe/api-key-staging`
- `roadcall/stripe/api-key-prod`

Use different API keys for each environment to isolate testing from production.

## Troubleshooting

### Secret Not Found

```
Error: Secret roadcall/stripe/api-key-prod not found
```

**Solution**: Verify the secret exists and the Lambda function has permission to access it.

```bash
aws secretsmanager describe-secret --secret-id roadcall/stripe/api-key-prod
```

### Secret Contains Placeholder

```
Error: Secret roadcall/stripe/api-key-prod contains placeholder value
```

**Solution**: Update the secret with actual credentials (see Initial Setup above).

### Cache Not Clearing After Rotation

**Solution**: Lambda functions automatically pick up new secret values on next invocation. If immediate update is needed, clear the cache:

```typescript
secretsManager.clearCache('roadcall/stripe/api-key-prod');
```

Or redeploy the Lambda function to force a cold start.

### High Secrets Manager API Costs

**Solution**: Ensure caching is enabled (default) and increase cache TTL if appropriate:

```typescript
// Increase cache TTL to 10 minutes
const secretsManager = new SecretsManagerWrapper(undefined, 600000);
```

## Compliance

This implementation meets the following compliance requirements:

- **PCI-DSS**: Stripe API keys are encrypted at rest with KMS and never logged
- **SOC 2**: Comprehensive audit logging of all secret access
- **GDPR**: Secrets are stored in appropriate AWS regions
- **HIPAA**: Encryption in transit (TLS 1.3) and at rest (KMS)

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Rotating Secrets](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
