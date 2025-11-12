# API Gateway Implementation

## Overview

This document describes the comprehensive API Gateway implementation for the AI Roadcall Assistant platform. The implementation provides a secure, scalable, and well-monitored API layer for all microservices.

## Architecture

### Main Components

1. **ApiGatewayStack**: Central API Gateway with security controls
2. **AuthStack**: Authentication service with JWT authorizer
3. **MicroserviceApi Construct**: Reusable construct for service endpoints
4. **Individual Service Stacks**: Each microservice integrates with the main API

### Security Features

#### 1. Authentication & Authorization

- **JWT Token Authorizer**: Custom Lambda authorizer validates JWT tokens
- **Token Caching**: 5-minute cache TTL for improved performance
- **Role-Based Access Control (RBAC)**: Enforced at the authorizer level
- **Per-Resource Authorization**: Services validate resource ownership

```typescript
// Example: Protected endpoint
{
  path: 'incidents/{id}',
  method: 'GET',
  handler: 'handlers/get-incident.handler',
  requiresAuth: true, // Requires valid JWT token
}
```

#### 2. Rate Limiting

Two-tier rate limiting strategy:

- **Standard Endpoints**: 100 requests/minute
- **Sensitive Endpoints**: 10 requests/minute (payments, admin operations)

```typescript
// Example: Sensitive endpoint with restricted rate limit
{
  path: 'payments/{id}/approve',
  method: 'POST',
  handler: 'handlers/approve-payment.handler',
  requiresAuth: true,
  isSensitive: true, // Applies 10 req/min limit
}
```

#### 3. Request Validation

JSON Schema validation at API Gateway level:

```typescript
{
  path: 'payments',
  method: 'POST',
  handler: 'handlers/create-payment.handler',
  requiresAuth: true,
  requestSchema: {
    type: apigateway.JsonSchemaType.OBJECT,
    required: ['incidentId', 'vendorId', 'amountCents'],
    properties: {
      incidentId: { type: apigateway.JsonSchemaType.STRING },
      vendorId: { type: apigateway.JsonSchemaType.STRING },
      amountCents: { type: apigateway.JsonSchemaType.INTEGER },
    },
  },
}
```

#### 4. AWS WAF Protection

Comprehensive WAF rules:

- **Rate Limiting**: 2000 requests per 5 minutes per IP
- **AWS Managed Rules**:
  - Core Rule Set (common vulnerabilities)
  - Known Bad Inputs
  - SQL Injection protection
- **Geo-Blocking**: Configurable country restrictions
- **Custom Response Bodies**: Structured error responses

#### 5. CORS Configuration

Stage-specific CORS policies:

- **Production**: Explicit allowed origins
- **Staging**: Development + staging origins
- **Development**: All origins allowed

```typescript
// Production CORS
allowOrigins: [
  'https://app.roadcall.com',
  'https://www.roadcall.com',
  'https://admin.roadcall.com',
]
```

### Observability

#### 1. CloudWatch Logging

- **Access Logs**: JSON format with standard fields
- **Execution Logs**: INFO level (prod), DEBUG level (dev)
- **Data Tracing**: Enabled in non-production environments
- **Retention**: 30 days (prod), 7 days (dev)

#### 2. AWS X-Ray Tracing

- **Distributed Tracing**: Enabled for all Lambda functions
- **API Gateway Tracing**: Full request/response tracing
- **Service Map**: Automatic dependency visualization
- **Performance Insights**: Latency analysis per endpoint

#### 3. CloudWatch Metrics

- **API Gateway Metrics**: Request count, latency, errors
- **Custom Metrics**: Business KPIs per service
- **Alarms**: P95 latency > 300ms triggers alerts

### Custom Domain Setup

Optional custom domain configuration with ACM certificate:

```typescript
// In CDK deployment
new ApiGatewayStack(this, 'ApiGateway', {
  stage: 'prod',
  domainName: 'api.roadcall.com',
  certificateArn: 'arn:aws:acm:...',
  hostedZoneId: 'Z1234567890ABC',
});
```

Features:
- TLS 1.2+ enforcement
- Automatic Route53 A record creation
- Base path mapping per stage
- Regional endpoint type

## Usage Guide

### Adding a New Service

1. **Define Routes**:

```typescript
const routes: RouteConfig[] = [
  {
    path: 'resource/{id}',
    method: 'GET',
    handler: 'handlers/get-resource.handler',
    requiresAuth: true,
    rateLimitPerMinute: 100,
    description: 'Get resource by ID',
    requestSchema: {
      // Optional request validation
    },
    responseSchema: {
      // Optional response model
    },
  },
];
```

2. **Create MicroserviceApi**:

```typescript
const microserviceApi = new MicroserviceApi(this, 'MyServiceApi', {
  serviceName: 'my-svc',
  stage,
  api, // Main API Gateway
  authorizer, // JWT authorizer
  environment: {
    TABLE_NAME: table.tableName,
  },
  routes,
});
```

3. **Grant Permissions**:

```typescript
microserviceApi.functions.forEach((fn) => {
  table.grantReadWriteData(fn);
  eventBus.grantPutEventsTo(fn);
});
```

### Route Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `path` | string | API path (e.g., 'users/{id}') | Required |
| `method` | string | HTTP method (GET, POST, etc.) | Required |
| `handler` | string | Lambda handler path | Required |
| `requiresAuth` | boolean | Require JWT authentication | true |
| `isSensitive` | boolean | Apply 10 req/min rate limit | false |
| `rateLimitPerMinute` | number | Custom rate limit | 100 |
| `requestSchema` | JsonSchema | Request validation schema | undefined |
| `responseSchema` | JsonSchema | Response model schema | undefined |
| `description` | string | Endpoint description | undefined |

### Error Response Format

All endpoints return standardized error responses:

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "code": "INVALID_INPUT",
    "details": {
      "field": "amountCents",
      "reason": "Must be a positive integer"
    },
    "requestId": "abc-123-def",
    "timestamp": "2025-11-11T10:30:00Z"
  }
}
```

HTTP Status Codes:
- `400`: Validation error
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Internal server error

## Deployment

### Prerequisites

1. Build all services:
```bash
pnpm install
pnpm build
```

2. Set environment variables:
```bash
export AWS_REGION=us-east-1
export STAGE=dev
```

### Deploy API Gateway

```bash
cd infrastructure
pnpm cdk deploy ApiGatewayStack --require-approval never
```

### Deploy with Custom Domain

```bash
# Create ACM certificate first (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name api.roadcall.com \
  --validation-method DNS \
  --region us-east-1

# Deploy with domain configuration
pnpm cdk deploy ApiGatewayStack \
  --context domainName=api.roadcall.com \
  --context certificateArn=arn:aws:acm:... \
  --context hostedZoneId=Z1234567890ABC
```

### Deploy All Services

```bash
pnpm cdk deploy --all --require-approval never
```

## Testing

### Test Authentication

```bash
# Register user
curl -X POST https://api.roadcall.com/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "role": "driver",
    "name": "John Doe"
  }'

# Verify OTP
curl -X POST https://api.roadcall.com/dev/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "otp": "123456"
  }'

# Response includes JWT token
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
  "expiresIn": 900
}
```

### Test Protected Endpoint

```bash
# Get user profile
curl -X GET https://api.roadcall.com/dev/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

### Test Rate Limiting

```bash
# Exceed rate limit
for i in {1..150}; do
  curl -X GET https://api.roadcall.com/dev/incidents \
    -H "Authorization: Bearer $TOKEN"
done

# Response after limit exceeded:
{
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED"
  }
}
```

### Test Request Validation

```bash
# Invalid request (missing required field)
curl -X POST https://api.roadcall.com/dev/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "vendor-123"
  }'

# Response:
{
  "message": "Invalid request body"
}
```

## Monitoring

### CloudWatch Dashboards

Access pre-configured dashboards:
1. API Gateway Overview
2. Service-specific metrics
3. Error rates and latency

### Key Metrics to Monitor

- **4XX Error Rate**: Should be < 5%
- **5XX Error Rate**: Should be < 1%
- **P95 Latency**: Should be < 300ms
- **P99 Latency**: Should be < 500ms
- **Throttled Requests**: Monitor for capacity issues

### X-Ray Service Map

View distributed traces:
```bash
aws xray get-service-graph \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)
```

### CloudWatch Logs Insights

Query API Gateway logs:
```sql
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

## Security Best Practices

1. **Never expose API keys**: Use Secrets Manager
2. **Rotate JWT secrets**: Every 90 days
3. **Monitor failed auth attempts**: Set up alarms
4. **Review WAF logs**: Weekly security audits
5. **Update managed rules**: Keep WAF rules current
6. **Validate all inputs**: Use JSON schemas
7. **Implement RBAC**: Check permissions in Lambda
8. **Log security events**: Audit all sensitive operations

## Troubleshooting

### Common Issues

#### 1. 401 Unauthorized

**Cause**: Invalid or expired JWT token

**Solution**:
- Verify token format: `Bearer <token>`
- Check token expiration
- Refresh token if expired

#### 2. 429 Rate Limit Exceeded

**Cause**: Too many requests

**Solution**:
- Implement exponential backoff
- Request rate limit increase if needed
- Use caching to reduce API calls

#### 3. 403 Forbidden (WAF Block)

**Cause**: WAF rule triggered

**Solution**:
- Check WAF logs in CloudWatch
- Review request for malicious patterns
- Whitelist legitimate traffic if needed

#### 4. 500 Internal Server Error

**Cause**: Lambda function error

**Solution**:
- Check Lambda logs in CloudWatch
- Review X-Ray traces
- Verify environment variables
- Check IAM permissions

### Debug Mode

Enable detailed logging:
```typescript
// In CDK stack
deployOptions: {
  loggingLevel: apigateway.MethodLoggingLevel.INFO,
  dataTraceEnabled: true,
}
```

## Performance Optimization

### Caching

Enable API Gateway caching:
```typescript
deployOptions: {
  cachingEnabled: true,
  cacheClusterSize: '0.5',
  cacheTtl: cdk.Duration.minutes(5),
}
```

### Lambda Optimization

- Use provisioned concurrency for critical endpoints
- Optimize cold start times
- Implement connection pooling
- Use Lambda layers for shared dependencies

### Database Optimization

- Use connection pooling (RDS Proxy)
- Implement read replicas
- Cache frequently accessed data
- Use DynamoDB DAX for hot data

## Compliance

### Data Protection

- All data encrypted in transit (TLS 1.2+)
- All data encrypted at rest (KMS)
- PII redaction in logs
- Audit logging enabled

### Regulatory Requirements

- **GDPR**: Data export and deletion APIs
- **CCPA**: Privacy controls implemented
- **PCI DSS**: Payment data handled by Stripe
- **SOC 2**: Audit logs retained for 7 years

## Future Enhancements

1. **GraphQL API**: Add AppSync for real-time features
2. **API Versioning**: Implement v1, v2 paths
3. **Advanced Caching**: CloudFront distribution
4. **Multi-Region**: Global API with Route53 failover
5. **API Documentation**: Auto-generated OpenAPI specs
6. **Developer Portal**: Self-service API key management

## References

- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS X-Ray Documentation](https://docs.aws.amazon.com/xray/)
- [API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/best-practices.html)
