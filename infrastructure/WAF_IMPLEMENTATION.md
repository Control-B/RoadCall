# AWS WAF Implementation

## Overview

This document describes the AWS WAF (Web Application Firewall) implementation for the AI Roadcall Assistant platform. The WAF provides comprehensive security protection for both API Gateway REST APIs and AppSync GraphQL APIs.

## Architecture

### WAF Stack (`waf-stack.ts`)

The WAF stack is a standalone, reusable CDK stack that creates:

1. **WAF Web ACL** - Contains all security rules
2. **S3 Logging Bucket** - Stores WAF logs for analysis
3. **CloudWatch Log Group** - Real-time WAF log streaming
4. **Logging Configuration** - Captures blocked and counted requests

### Protected Resources

The WAF is attached to:

1. **API Gateway** - Main REST API (`api-gateway-stack.ts`)
2. **AppSync GraphQL API** - Real-time tracking service (`tracking-stack.ts`)

## Security Rules

### 1. Rate Limiting Rule (Priority 1)

**Purpose**: Prevent DDoS attacks and API abuse

**Configuration**:
- Limit: 2,000 requests per 5 minutes per IP address
- Action: Block with HTTP 429 (Too Many Requests)
- Custom response body with error details

**Requirement**: 12.1, 18.1

### 2. AWS Managed Rules - Core Rule Set (Priority 2)

**Purpose**: Protection against common web exploits

**Includes**:
- Cross-Site Scripting (XSS) protection
- SQL Injection protection
- Local File Inclusion (LFI) attacks
- Remote File Inclusion (RFI) attacks
- Command injection protection

**Requirement**: 18.1, 18.2

### 3. AWS Managed Rules - Known Bad Inputs (Priority 3)

**Purpose**: Block requests with patterns known to be malicious

**Includes**:
- Known malicious user agents
- Known bad bot patterns
- Exploit attempt patterns

**Requirement**: 18.1

### 4. AWS Managed Rules - SQL Injection Protection (Priority 4)

**Purpose**: Enhanced SQL injection detection and prevention

**Includes**:
- SQL syntax detection in query strings
- SQL syntax detection in request bodies
- SQL syntax detection in URI paths
- SQL syntax detection in headers

**Requirement**: 18.2

### 5. AWS Managed Rules - Linux OS Protection (Priority 5)

**Purpose**: Protect against Linux-specific exploits

**Includes**:
- Shell command injection
- Path traversal attacks
- Linux-specific exploit patterns

**Requirement**: 18.1

### 6. AWS Managed Rules - IP Reputation List (Priority 6)

**Purpose**: Block requests from known malicious IP addresses

**Includes**:
- Amazon threat intelligence
- Known botnet IPs
- Known attack sources

**Requirement**: 12.1

### 7. AWS Managed Rules - Anonymous IP List (Priority 7)

**Purpose**: Block requests from anonymous proxies and VPNs

**Includes**:
- Tor exit nodes
- Anonymous proxy services
- VPN services
- Hosting providers commonly used for attacks

**Requirement**: 12.1

### 8. Geo-Blocking Rule (Priority 8)

**Purpose**: Block traffic from high-risk countries

**Configuration**:
- Production: Blocks specific high-risk countries (KP, IR, SY, CU)
- Development/Staging: No geo-blocking (for testing)
- Customizable via `getBlockedCountries()` method

**Requirement**: 12.1

## Logging and Monitoring

### S3 Logging

**Bucket**: `roadcall-waf-logs-{stage}-{account}`

**Features**:
- Server-side encryption (S3-managed)
- Block all public access
- Lifecycle policies:
  - Transition to Glacier after 30 days
  - Delete after 90 days
- Retention policy: RETAIN in prod, DESTROY in dev/staging

**Log Format**: JSON format with full request details

### CloudWatch Logging

**Log Group**: `/aws/wafv2/roadcall-{stage}`

**Features**:
- Real-time log streaming
- Retention: 1 month (prod), 1 week (dev/staging)
- Structured JSON logs
- Integrated with CloudWatch Insights

### Log Filtering

**Captured Events**:
- All BLOCK actions (security threats)
- All COUNT actions (monitoring mode)

**Redacted Fields**:
- Authorization headers
- Cookie headers

### CloudWatch Metrics

Each rule publishes metrics to CloudWatch:

- `RateLimitRule` - Rate limit violations
- `AWSManagedRulesCommonRuleSet` - Common exploit attempts
- `AWSManagedRulesKnownBadInputsRuleSet` - Known bad inputs
- `AWSManagedRulesSQLiRuleSet` - SQL injection attempts
- `AWSManagedRulesLinuxRuleSet` - Linux exploit attempts
- `AWSManagedRulesAmazonIpReputationList` - Malicious IP blocks
- `AWSManagedRulesAnonymousIpList` - Anonymous IP blocks
- `GeoBlockingRule` - Geo-blocked requests

## Custom Response Bodies

### Rate Limit Exceeded (HTTP 429)

```json
{
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests from your IP address. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED"
  }
}
```

### Geo-Blocked (HTTP 403)

```json
{
  "error": {
    "type": "FORBIDDEN",
    "message": "Access denied from your location.",
    "code": "GEO_BLOCKED"
  }
}
```

### SQL Injection Detected (HTTP 403)

```json
{
  "error": {
    "type": "FORBIDDEN",
    "message": "Request blocked due to security policy.",
    "code": "SQL_INJECTION_DETECTED"
  }
}
```

### XSS Detected (HTTP 403)

```json
{
  "error": {
    "type": "FORBIDDEN",
    "message": "Request blocked due to security policy.",
    "code": "XSS_DETECTED"
  }
}
```

## Deployment

### Prerequisites

1. AWS CDK installed and configured
2. Appropriate AWS credentials with WAF permissions
3. Existing API Gateway and AppSync APIs

### Deploy WAF Stack

```bash
# Deploy to development
pnpm cdk deploy RoadcallWafStack-dev --context stage=dev

# Deploy to staging
pnpm cdk deploy RoadcallWafStack-staging --context stage=staging

# Deploy to production
pnpm cdk deploy RoadcallWafStack-prod --context stage=prod
```

### Deploy with API Gateway and AppSync

The WAF stack is automatically deployed and associated when deploying the full application:

```bash
# Deploy all stacks
pnpm cdk deploy --all --context stage=dev
```

## Configuration

### Customizing Geo-Blocking

Edit the `getBlockedCountries()` method in `waf-stack.ts`:

```typescript
private getBlockedCountries(stage: string): string[] {
  if (stage !== 'prod') {
    return [];
  }
  
  return [
    'KP', // North Korea
    'IR', // Iran
    'SY', // Syria
    'CU', // Cuba
    // Add more ISO 3166-1 alpha-2 country codes
  ];
}
```

### Adjusting Rate Limits

Modify the rate limit in the `createWafRules()` method:

```typescript
{
  name: 'RateLimitRule',
  priority: 1,
  statement: {
    rateBasedStatement: {
      limit: 2000, // Change this value
      aggregateKeyType: 'IP',
    },
  },
  // ...
}
```

### Excluding Specific Rules

To exclude specific managed rules, add them to the `excludedRules` array:

```typescript
{
  name: 'AWSManagedRulesCommonRuleSet',
  priority: 2,
  statement: {
    managedRuleGroupStatement: {
      vendorName: 'AWS',
      name: 'AWSManagedRulesCommonRuleSet',
      excludedRules: [
        { name: 'SizeRestrictions_BODY' },
        { name: 'GenericRFI_BODY' },
      ],
    },
  },
  // ...
}
```

## Monitoring and Alerting

### CloudWatch Alarms

Create alarms for security events:

```typescript
// Example: Alert on high rate limit violations
const rateLimitAlarm = new cloudwatch.Alarm(this, 'RateLimitAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/WAFV2',
    metricName: 'BlockedRequests',
    dimensionsMap: {
      Rule: 'RateLimitRule',
      WebACL: `roadcall-waf-${stage}`,
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 100,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});
```

### Log Analysis

Query WAF logs using CloudWatch Insights:

```sql
-- Top blocked IPs
fields httpRequest.clientIp, @timestamp
| filter action = "BLOCK"
| stats count() as blockCount by httpRequest.clientIp
| sort blockCount desc
| limit 20

-- SQL injection attempts
fields httpRequest.uri, httpRequest.clientIp, @timestamp
| filter terminatingRuleId contains "SQLi"
| sort @timestamp desc

-- Rate limit violations
fields httpRequest.clientIp, @timestamp
| filter terminatingRuleId = "RateLimitRule"
| stats count() as violations by httpRequest.clientIp
| sort violations desc
```

## Testing

### Test Rate Limiting

```bash
# Send rapid requests to trigger rate limit
for i in {1..2100}; do
  curl -X GET https://api.roadcall.com/incidents
done
```

### Test SQL Injection Protection

```bash
# Attempt SQL injection (should be blocked)
curl -X GET "https://api.roadcall.com/incidents?id=1' OR '1'='1"
```

### Test XSS Protection

```bash
# Attempt XSS (should be blocked)
curl -X POST https://api.roadcall.com/incidents \
  -H "Content-Type: application/json" \
  -d '{"notes": "<script>alert(\"XSS\")</script>"}'
```

### Test Geo-Blocking

Use a VPN or proxy from a blocked country and attempt to access the API.

## Compliance

This WAF implementation helps meet the following compliance requirements:

- **OWASP Top 10**: Protection against common web vulnerabilities
- **PCI DSS**: Web application firewall requirement (6.6)
- **SOC 2**: Security monitoring and logging
- **GDPR**: Data protection through security controls

## Cost Optimization

### Estimated Costs (per month)

- WAF Web ACL: $5.00
- WAF Rules (8 rules): $8.00
- Requests (1M requests): $0.60
- Logging to S3: ~$0.50
- CloudWatch Logs: ~$1.00

**Total**: ~$15.10/month for 1M requests

### Cost Reduction Tips

1. Use CloudWatch Logs only (disable S3 logging if not needed)
2. Reduce log retention periods in dev/staging
3. Use sampling for high-traffic environments
4. Review and remove unused rules

## Troubleshooting

### False Positives

If legitimate requests are being blocked:

1. Check CloudWatch Logs to identify the blocking rule
2. Review the request pattern
3. Add the rule to `excludedRules` if appropriate
4. Consider using COUNT mode instead of BLOCK for testing

### High Costs

If WAF costs are higher than expected:

1. Review request volume in CloudWatch metrics
2. Check for DDoS attacks or bot traffic
3. Implement additional rate limiting at API Gateway level
4. Consider using AWS Shield for DDoS protection

### Performance Impact

WAF adds minimal latency (<1ms typically):

1. Monitor API Gateway latency metrics
2. Use X-Ray tracing to identify bottlenecks
3. Ensure rules are optimized (higher priority = evaluated first)

## Security Best Practices

1. **Regular Updates**: AWS managed rules are automatically updated
2. **Log Review**: Regularly review WAF logs for security threats
3. **Testing**: Test WAF rules in staging before production
4. **Monitoring**: Set up CloudWatch alarms for security events
5. **Incident Response**: Have a plan for responding to blocked attacks
6. **Documentation**: Keep this document updated with configuration changes

## References

- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)
- [WAF Best Practices](https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html)
- Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 18.1, 18.2

## Support

For issues or questions:

1. Check CloudWatch Logs for error details
2. Review this documentation
3. Contact the DevOps team
4. Create a ticket in the issue tracker
