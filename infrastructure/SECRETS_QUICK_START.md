# Secrets Manager Quick Start Guide

## TL;DR

```bash
# 1. Deploy secrets infrastructure
cd infrastructure
pnpm cdk deploy SecretsStack

# 2. Set up secrets
./scripts/setup-secrets.sh prod

# 3. Use in Lambda
import { secretsManager } from '@roadcall/aws-clients';
const secrets = await secretsManager.getSecretJSON('roadcall/stripe/api-key-prod');
```

## Common Operations

### Get a Secret

```typescript
import { secretsManager } from '@roadcall/aws-clients';

// Simple string secret
const apiKey = await secretsManager.getSecret('my-secret');

// JSON secret with safe wrappers
const config = await secretsManager.getSecretJSON<{
  apiKey: SecretValue;
  endpoint: string;
}>('my-config');

// Use the secret
const client = new API(config.apiKey.getValue());
```

### Update a Secret

```bash
# Via AWS CLI
aws secretsmanager update-secret \
  --secret-id roadcall/stripe/api-key-prod \
  --secret-string '{"apiKey":"sk_live_...","publishableKey":"pk_live_..."}'

# Via Console
AWS Console > Secrets Manager > [Secret] > Retrieve secret value > Edit
```

### Clear Cache

```typescript
// Clear specific secret
secretsManager.clearCache('my-secret');

// Clear all secrets
secretsManager.clearCache();
```

### Warmup Secrets (Cold Start Optimization)

```typescript
import { warmupSecrets } from '@roadcall/aws-clients';

// Outside handler
const SECRETS = ['roadcall/stripe/api-key-prod', 'roadcall/weather/api-key-prod'];
warmupSecrets(SECRETS);

export const handler = async (event) => {
  // Secrets already cached
};
```

## Security Checklist

- ✅ Never log secret values
- ✅ Use SecretValue wrappers
- ✅ Validate secrets aren't placeholders
- ✅ Grant least-privilege IAM access
- ✅ Enable automatic rotation
- ✅ Monitor access failures
- ✅ Use KMS encryption

## Troubleshooting

### Secret Not Found
```bash
aws secretsmanager describe-secret --secret-id <secret-name>
```

### Check Lambda Permissions
```bash
aws lambda get-policy --function-name <function-name>
```

### View Rotation Status
```bash
aws secretsmanager describe-secret --secret-id <secret-name> | jq '.RotationEnabled'
```

### Monitor Access
```bash
aws logs tail /aws/lambda/<function-name> --follow --filter-pattern "secret"
```

## Secret Naming Convention

```
roadcall/<service>/<secret-type>-<stage>

Examples:
- roadcall/stripe/api-key-prod
- roadcall/weather/api-key-dev
- roadcall/database/credentials-staging
```

## Cost Optimization

- Enable caching (default 5 minutes)
- Use warmup for frequently accessed secrets
- Batch secret retrievals when possible
- Monitor API call metrics

## Support

- Documentation: `infrastructure/SECRETS_MANAGEMENT.md`
- Examples: `services/*/src/handlers/*.ts`
- Tests: `packages/*/src/__tests__/*.test.ts`
