# Vendor Data Pipeline - Quick Reference

## Quick Start

```typescript
import { VendorDataPipeline } from '@roadcall/vendor-data-pipeline-svc';

const pipeline = new VendorDataPipeline();
const result = await pipeline.processTarget(target);
```

## API Endpoints

### Scraping
```bash
# Single target
POST /scrape/single
{
  "target": {
    "targetId": "vendor-123",
    "url": "https://example.com/vendor",
    "sourceType": "profile",
    "selectors": { ... }
  }
}

# Batch
POST /scrape/batch
{
  "targets": [ ... ]
}

# Status
GET /status
```

### Verification Queue
```bash
# Get pending items
GET /verification/pending?limit=50

# Approve item
POST /verification/{itemId}/approve
{
  "verifiedBy": "user-123"
}

# Reject item
POST /verification/{itemId}/reject
{
  "verifiedBy": "user-123",
  "reason": "Duplicate entry"
}
```

## Configuration

### Environment Variables
```bash
PROXY_URLS='[{"proxyUrl":"http://proxy.example.com:8080"}]'
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=100
DELAY_BETWEEN_REQUESTS=1000
AUDIT_TABLE_NAME=VendorDataAuditLog
VERIFICATION_QUEUE_TABLE_NAME=VendorVerificationQueue
```

### Rate Limiting
```typescript
const pipeline = new VendorDataPipeline(proxies, {
  requestsPerMinute: 10,
  requestsPerHour: 100,
  delayBetweenRequests: 1000
});
```

### Proxy Configuration
```typescript
const proxies = [
  {
    proxyUrl: 'http://proxy1.example.com:8080',
    username: 'user',
    password: 'pass',
    region: 'us-east',
    failureCount: 0
  }
];
```

## Scraping Target Format

```typescript
{
  targetId: 'unique-id',
  url: 'https://example.com/page',
  sourceType: 'directory' | 'listing' | 'profile',
  selectors: {
    businessName: '.business-name',
    phone: '.phone',
    address: '.address',
    services: '.services',
    hours: '.hours'
  },
  metadata: {
    region: 'us-east',
    category: 'towing',
    priority: 1
  }
}
```

## Circuit Breaker States

- **CLOSED**: Normal operation
- **OPEN**: Halted due to high error rate (>10%)
- **HALF_OPEN**: Testing recovery

```typescript
const status = pipeline.getStatus();
console.log(status.circuitBreaker.state); // CLOSED | OPEN | HALF_OPEN
```

## Compliance Checks

### Robots.txt
```typescript
const robotsChecker = new RobotsChecker();
const { allowed, reason } = await robotsChecker.isAllowed(url);
```

### Legal Flags
```typescript
pipeline.checkCompliance(['copyright_violation']);
// Circuit breaker will open
```

## Monitoring

### CloudWatch Metrics
- `ScrapingSuccessRate`
- `CircuitBreakerState`
- `RateLimitHits`
- `ProxyFailures`
- `VerificationQueueDepth`

### CloudWatch Alarms
- Circuit breaker opened
- High error rate (>5%)
- Verification queue backlog (>100)
- All proxies failed

## Common Patterns

### Retry on Failure
```typescript
let retries = 3;
while (retries > 0) {
  try {
    const result = await pipeline.processTarget(target);
    if (result.success) break;
  } catch (error) {
    retries--;
    await sleep(1000 * (4 - retries));
  }
}
```

### Batch with Progress
```typescript
for (let i = 0; i < targets.length; i += 10) {
  const batch = targets.slice(i, i + 10);
  const results = await pipeline.processBatch(batch);
  console.log(`Progress: ${i + results.length}/${targets.length}`);
}
```

### Manual Verification Workflow
```typescript
const queue = pipeline.getVerificationQueue();

// Get pending
const items = await queue.getPendingItems(50);

// Review and approve/reject
for (const item of items) {
  if (isValid(item.vendorData)) {
    await queue.approve(item.itemId, userId);
  } else {
    await queue.reject(item.itemId, userId, reason);
  }
}
```

## Troubleshooting

### Circuit Breaker Opened
```bash
# Check status
GET /status

# Review audit logs
aws dynamodb query \
  --table-name VendorDataAuditLog \
  --index-name ActionIndex \
  --key-condition-expression "action = :action" \
  --expression-attribute-values '{":action":{"S":"scrape_failed"}}'

# Reset (admin only)
POST /reset
```

### All Proxies Failed
```bash
# Check proxy status
GET /status

# Review proxy failures in audit log
# Add new proxies or reset existing ones
```

### Rate Limit Exceeded
```bash
# Adjust rate limits
export RATE_LIMIT_PER_MINUTE=5
export RATE_LIMIT_PER_HOUR=50

# Or wait for rate limit window to reset
```

## Best Practices

1. **Always check robots.txt** - Automatic, but verify compliance
2. **Use proxies** - Distribute load and avoid IP blocking
3. **Monitor circuit breaker** - Halt on high error rates
4. **Manual verification** - Review all data before use
5. **Audit logging** - Maintain complete provenance
6. **Rate limiting** - Respect source websites
7. **Legal compliance** - Check terms of service

## Support

For issues or questions:
- Check CloudWatch logs
- Review audit table
- Check circuit breaker state
- Verify proxy configuration
- Contact platform team
