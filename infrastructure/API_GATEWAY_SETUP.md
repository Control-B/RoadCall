# API Gateway Setup Guide

## Quick Start

### 1. Prerequisites

Ensure you have the following installed:
- Node.js 20+
- pnpm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### 2. Build Services

```bash
# From project root
pnpm install
pnpm build
```

### 3. Deploy Infrastructure

```bash
cd infrastructure

# Deploy all stacks
pnpm cdk deploy --all --require-approval never

# Or deploy specific stacks
pnpm cdk deploy ApiGatewayStack
pnpm cdk deploy AuthStack
pnpm cdk deploy DriverStack
# ... etc
```

### 4. Get API URL

```bash
# Get the API Gateway URL
aws cloudformation describe-stacks \
  --stack-name ApiGatewayStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Web App, Mobile App, External Services)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS WAF                                 │
│  • Rate Limiting (2000 req/5min per IP)                     │
│  • SQL Injection Protection                                  │
│  • XSS Protection                                            │
│  • Geo-blocking                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway (REST)                         │
│  • JWT Authorization                                         │
│  • Request Validation                                        │
│  • Rate Limiting (100/10 req/min)                           │
│  • CORS Configuration                                        │
│  • CloudWatch Logging                                        │
│  • X-Ray Tracing                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌────────┐     ┌────────┐
    │Auth Svc│     │Driver  │     │Incident│
    │        │     │Service │     │Service │
    └────────┘     └────────┘     └────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   DynamoDB   │
                  │   Aurora     │
                  │   Redis      │
                  └──────────────┘
```

## Security Controls

### 1. Authentication & Authorization

#### JWT Token Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AG as API Gateway
    participant A as Authorizer
    participant L as Lambda
    
    C->>AG: Request + JWT Token
    AG->>A: Validate Token
    A->>A: Verify Signature
    A->>A: Check Expiration
    A->>A: Extract Claims
    A-->>AG: Policy Document
    AG->>L: Forward Request + Context
    L->>L: Check Permissions
    L-->>AG: Response
    AG-->>C: Response
```

#### Token Format

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Token Claims

```json
{
  "sub": "user-123",
  "role": "driver",
  "companyId": "company-456",
  "iat": 1699704000,
  "exp": 1699704900
}
```

### 2. Rate Limiting

Two-tier rate limiting strategy:

| Tier | Rate Limit | Burst Limit | Use Case |
|------|------------|-------------|----------|
| Standard | 100 req/min | 200 req/min | General endpoints |
| Sensitive | 10 req/min | 20 req/min | Payments, admin |

#### Configuring Rate Limits

```typescript
// In route configuration
{
  path: 'payments/{id}/approve',
  method: 'POST',
  handler: 'handlers/approve-payment.handler',
  isSensitive: true, // Applies 10 req/min limit
}
```

### 3. Request Validation

JSON Schema validation at API Gateway level prevents invalid requests from reaching Lambda functions.

#### Example Schema

```typescript
requestSchema: {
  type: apigateway.JsonSchemaType.OBJECT,
  required: ['incidentId', 'vendorId', 'amountCents'],
  properties: {
    incidentId: {
      type: apigateway.JsonSchemaType.STRING,
      pattern: '^[a-zA-Z0-9-]+$',
      minLength: 1,
      maxLength: 100,
    },
    vendorId: {
      type: apigateway.JsonSchemaType.STRING,
      pattern: '^[a-zA-Z0-9-]+$',
    },
    amountCents: {
      type: apigateway.JsonSchemaType.INTEGER,
      minimum: 1,
      maximum: 10000000,
    },
  },
}
```

### 4. WAF Rules

#### Managed Rules

- **Core Rule Set**: Protection against common vulnerabilities
- **Known Bad Inputs**: Blocks known malicious patterns
- **SQL Injection**: Prevents SQL injection attacks

#### Custom Rules

- **Rate Limiting**: 2000 requests per 5 minutes per IP
- **Geo-blocking**: Configurable country restrictions

#### WAF Logging

```bash
# View WAF logs
aws logs tail /aws-waf-logs/roadcall-api-waf-dev --follow
```

### 5. CORS Configuration

Stage-specific CORS policies:

```typescript
// Production
allowOrigins: [
  'https://app.roadcall.com',
  'https://www.roadcall.com',
  'https://admin.roadcall.com',
]

// Staging
allowOrigins: [
  'https://staging.roadcall.com',
  'http://localhost:3000',
  'http://localhost:3001',
]

// Development
allowOrigins: apigateway.Cors.ALL_ORIGINS
```

## Custom Domain Setup

### Option 1: Automated Setup

Use the provided script:

```bash
cd infrastructure/scripts
./setup-custom-domain.sh api.roadcall.com
```

The script will:
1. Check Route53 hosted zone
2. Request ACM certificate
3. Create DNS validation records
4. Wait for validation
5. Deploy API Gateway with custom domain

### Option 2: Manual Setup

#### Step 1: Request Certificate

```bash
aws acm request-certificate \
  --domain-name api.roadcall.com \
  --validation-method DNS \
  --region us-east-1
```

#### Step 2: Validate Certificate

Add the CNAME record provided by ACM to your Route53 hosted zone.

#### Step 3: Deploy with Custom Domain

```bash
pnpm cdk deploy ApiGatewayStack \
  --context domainName=api.roadcall.com \
  --context certificateArn=arn:aws:acm:... \
  --context hostedZoneId=Z1234567890ABC
```

## Monitoring & Observability

### CloudWatch Dashboards

Access pre-configured dashboards in AWS Console:

1. **API Gateway Overview**
   - Request count
   - Error rates (4XX, 5XX)
   - Latency (P50, P95, P99)
   - Cache hit/miss rates

2. **Service-Specific Metrics**
   - Per-endpoint metrics
   - Lambda invocations
   - DynamoDB operations

### CloudWatch Alarms

Automatic alarms are created for:

- **High Error Rate**: 5XX errors > 1%
- **High Latency**: P95 > 300ms
- **Throttling**: Throttled requests > 10/min
- **WAF Blocks**: Blocked requests > 100/min

### X-Ray Tracing

View distributed traces:

```bash
# Get service map
aws xray get-service-graph \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)

# Get trace summaries
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --filter-expression 'service("roadcall-api-dev")'
```

### CloudWatch Logs Insights

#### Query API Gateway Logs

```sql
fields @timestamp, @message, requestId, status, latency
| filter status >= 400
| sort @timestamp desc
| limit 100
```

#### Query Lambda Logs

```sql
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
```

## Testing

### Run Test Suite

```bash
cd infrastructure/scripts
export API_URL=https://api.roadcall.com/dev
./test-api-gateway.sh
```

The test suite validates:
- ✓ CORS configuration
- ✓ Request validation
- ✓ Authentication
- ✓ Rate limiting
- ✓ HTTP method validation
- ✓ Content-Type validation
- ✓ Security headers
- ✓ Error response format
- ✓ WAF protection
- ✓ Payload size limits
- ✓ CloudWatch logging
- ✓ X-Ray tracing
- ✓ WAF association

### Manual Testing

#### Test Authentication

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

# Get user profile
TOKEN="<access_token_from_verify>"
curl -X GET https://api.roadcall.com/dev/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

#### Test Rate Limiting

```bash
# Send multiple requests
for i in {1..150}; do
  curl -X GET https://api.roadcall.com/dev/incidents \
    -H "Authorization: Bearer $TOKEN"
  sleep 0.1
done
```

#### Test Request Validation

```bash
# Invalid request (missing required field)
curl -X POST https://api.roadcall.com/dev/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "vendor-123"
  }'

# Expected response: 400 Bad Request
```

## Troubleshooting

### Common Issues

#### 1. 401 Unauthorized

**Symptoms**: All protected endpoints return 401

**Possible Causes**:
- Invalid JWT token
- Expired token
- Missing Authorization header
- Incorrect token format

**Solutions**:
```bash
# Check token format
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq

# Verify token expiration
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq '.exp'

# Refresh token
curl -X POST https://api.roadcall.com/dev/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh_token>"}'
```

#### 2. 429 Rate Limit Exceeded

**Symptoms**: Requests return 429 after threshold

**Solutions**:
- Implement exponential backoff
- Cache responses when possible
- Request rate limit increase

```typescript
// Exponential backoff example
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

#### 3. 403 Forbidden (WAF Block)

**Symptoms**: Legitimate requests blocked by WAF

**Solutions**:
```bash
# Check WAF logs
aws wafv2 get-sampled-requests \
  --web-acl-arn <web-acl-arn> \
  --rule-metric-name RateLimitRule \
  --scope REGIONAL \
  --time-window StartTime=$(date -u -d '1 hour ago' +%s),EndTime=$(date -u +%s) \
  --max-items 100

# Whitelist IP if needed (use with caution)
aws wafv2 update-ip-set \
  --scope REGIONAL \
  --id <ip-set-id> \
  --addresses <ip-address>/32
```

#### 4. 500 Internal Server Error

**Symptoms**: Lambda function errors

**Solutions**:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/roadcall-<service>-<function>-dev --follow

# Check X-Ray traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --filter-expression 'error = true'

# Verify environment variables
aws lambda get-function-configuration \
  --function-name roadcall-<service>-<function>-dev \
  --query 'Environment.Variables'
```

### Debug Mode

Enable detailed logging:

```typescript
// In CDK stack
deployOptions: {
  loggingLevel: apigateway.MethodLoggingLevel.INFO,
  dataTraceEnabled: true,
  metricsEnabled: true,
}
```

## Performance Optimization

### API Gateway Caching

Enable caching for frequently accessed endpoints:

```typescript
deployOptions: {
  cachingEnabled: true,
  cacheClusterSize: '0.5', // GB
  cacheTtl: cdk.Duration.minutes(5),
}
```

### Lambda Optimization

- **Provisioned Concurrency**: Reduce cold starts
- **Memory Allocation**: Optimize for performance
- **Connection Pooling**: Reuse database connections
- **Lambda Layers**: Share dependencies

### Database Optimization

- **RDS Proxy**: Connection pooling for Aurora
- **DynamoDB DAX**: In-memory cache
- **Read Replicas**: Distribute read load
- **Indexes**: Optimize query patterns

## Cost Optimization

### API Gateway Costs

- **Requests**: $3.50 per million requests
- **Data Transfer**: $0.09 per GB
- **Caching**: $0.02 per hour per GB

### Optimization Strategies

1. **Enable Caching**: Reduce backend calls
2. **Compress Responses**: Reduce data transfer
3. **Use Regional Endpoints**: Lower latency and cost
4. **Monitor Usage**: Set up billing alarms

```bash
# Set billing alarm
aws cloudwatch put-metric-alarm \
  --alarm-name api-gateway-cost-alarm \
  --alarm-description "Alert when API Gateway costs exceed $100" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

## Best Practices

### Security

1. ✓ Always use HTTPS
2. ✓ Validate all inputs
3. ✓ Implement rate limiting
4. ✓ Use JWT tokens with short expiration
5. ✓ Enable WAF protection
6. ✓ Log all security events
7. ✓ Rotate secrets regularly
8. ✓ Use least-privilege IAM policies

### Performance

1. ✓ Enable caching where appropriate
2. ✓ Optimize Lambda cold starts
3. ✓ Use connection pooling
4. ✓ Implement pagination
5. ✓ Compress responses
6. ✓ Use CDN for static content

### Monitoring

1. ✓ Set up CloudWatch alarms
2. ✓ Enable X-Ray tracing
3. ✓ Monitor error rates
4. ✓ Track latency metrics
5. ✓ Review WAF logs regularly
6. ✓ Analyze cost trends

## Support

For issues or questions:

1. Check CloudWatch Logs
2. Review X-Ray traces
3. Consult this documentation
4. Contact DevOps team

## References

- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS X-Ray Documentation](https://docs.aws.amazon.com/xray/)
- [API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/best-practices.html)
