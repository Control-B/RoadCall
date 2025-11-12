# API Gateway Quick Reference

## Common Commands

### Deploy
```bash
# Deploy API Gateway
pnpm cdk deploy ApiGatewayStack

# Deploy all services
pnpm cdk deploy --all

# Deploy specific service
pnpm cdk deploy DriverStack
```

### Test
```bash
# Run test suite
./infrastructure/scripts/test-api-gateway.sh

# Test authentication
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"+15551234567","role":"driver","name":"Test"}'
```

### Monitor
```bash
# View API Gateway logs
aws logs tail /aws/apigateway/roadcall-dev --follow

# View Lambda logs
aws logs tail /aws/lambda/roadcall-auth-register-dev --follow

# Get X-Ray traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)
```

## Route Configuration

### Standard Endpoint
```typescript
{
  path: 'resources/{id}',
  method: 'GET',
  handler: 'handlers/get-resource.handler',
  requiresAuth: true,
  rateLimitPerMinute: 100,
}
```

### Sensitive Endpoint
```typescript
{
  path: 'payments/{id}/approve',
  method: 'POST',
  handler: 'handlers/approve-payment.handler',
  requiresAuth: true,
  isSensitive: true, // 10 req/min
}
```

### With Validation
```typescript
{
  path: 'resources',
  method: 'POST',
  handler: 'handlers/create-resource.handler',
  requiresAuth: true,
  requestSchema: {
    type: apigateway.JsonSchemaType.OBJECT,
    required: ['name'],
    properties: {
      name: { type: apigateway.JsonSchemaType.STRING },
    },
  },
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid request body/parameters |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Rate Limits

| Type | Limit | Burst | Daily Quota |
|------|-------|-------|-------------|
| Standard | 100/min | 200/min | 144,000 |
| Sensitive | 10/min | 20/min | 14,400 |
| WAF | 2000/5min | - | - |

## Environment Variables

```bash
# Required for deployment
export AWS_REGION=us-east-1
export STAGE=dev

# Optional for custom domain
export DOMAIN_NAME=api.roadcall.com
export CERTIFICATE_ARN=arn:aws:acm:...
export HOSTED_ZONE_ID=Z1234567890ABC
```

## Useful Links

- [Full Implementation Guide](./API_GATEWAY_IMPLEMENTATION.md)
- [Setup Guide](./API_GATEWAY_SETUP.md)
- [Example Usage](./examples/api-gateway-usage.ts)
- [AWS API Gateway Docs](https://docs.aws.amazon.com/apigateway/)
