# Vendor Data Pipeline Service

A compliant and ethical web scraping service for collecting vendor data from public sources.

## Features

- **Robots.txt Compliance**: Automatically checks and respects robots.txt directives
- **Rate Limiting**: Configurable rate limits to avoid service disruption
- **Proxy Rotation**: IP rotation using proxy services to distribute load
- **Circuit Breaker**: Automatic halt when error rates exceed 10%
- **Audit Logging**: Complete data provenance tracking
- **Manual Verification**: Queue system for human review before data usage
- **Legal Compliance**: Built-in compliance checks and flags

## Architecture

```
┌─────────────────┐
│  Lambda Handler │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Data Pipeline  │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬──────────────┬─────────────┐
    ▼         ▼            ▼              ▼             ▼
┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────────┐ ┌────────┐
│ Robots │ │ Rate │ │  Proxy   │ │   Circuit    │ │ Audit  │
│Checker │ │Limiter│ │ Manager  │ │   Breaker    │ │ Logger │
└────────┘ └──────┘ └──────────┘ └──────────────┘ └────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Web Scraper  │
                    │ (Playwright) │
                    └──────┬───────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Verification    │
                  │     Queue       │
                  └─────────────────┘
```

## Components

### 1. Robots Checker
- Fetches and parses robots.txt files
- Caches results for 24 hours
- Respects crawl-delay directives
- Conservative approach on errors

### 2. Rate Limiter
- Configurable requests per minute/hour
- Enforces delay between requests
- Prevents service disruption

### 3. Proxy Manager
- Round-robin proxy rotation
- Automatic failure tracking
- Removes proxies after 3 failures
- Supports authenticated proxies

### 4. Circuit Breaker
- Opens at 10% error rate
- 60-second timeout before retry
- Tracks last 100 requests
- Manual reset capability

### 5. Web Scraper
- Playwright-based scraping
- Headless browser automation
- Custom selector support
- Automatic data extraction

### 6. Verification Queue
- DynamoDB-backed queue
- Manual approval workflow
- Rejection with reasons
- Status tracking

### 7. Audit Logger
- Complete activity logging
- Data provenance tracking
- CloudWatch integration
- Compliance reporting

## Usage

### Single Target Scraping

```typescript
import { VendorDataPipeline } from '@roadcall/vendor-data-pipeline-svc';

const pipeline = new VendorDataPipeline(proxies, rateLimitConfig);

const result = await pipeline.processTarget({
  targetId: 'target-123',
  url: 'https://example.com/vendor',
  sourceType: 'profile',
  selectors: {
    businessName: '.business-name',
    phone: '.phone-number',
    address: '.address'
  },
  metadata: {
    region: 'us-east',
    category: 'towing'
  }
});
```

### Batch Scraping

```typescript
const results = await pipeline.processBatch(targets);

console.log(`Processed: ${results.length}`);
console.log(`Successful: ${results.filter(r => r.success).length}`);
```

### Verification Queue

```typescript
const queue = pipeline.getVerificationQueue();

// Get pending items
const pending = await queue.getPendingItems(50);

// Approve item
await queue.approve(itemId, verifiedBy);

// Reject item
await queue.reject(itemId, verifiedBy, reason);
```

## Lambda Handlers

### Scrape Single Target
```bash
aws lambda invoke \
  --function-name vendor-data-scrape-single \
  --payload '{"target": {...}}' \
  response.json
```

### Scrape Batch
```bash
aws lambda invoke \
  --function-name vendor-data-scrape-batch \
  --payload '{"targets": [...]}' \
  response.json
```

### Get Pipeline Status
```bash
aws lambda invoke \
  --function-name vendor-data-pipeline-status \
  response.json
```

## Environment Variables

- `PROXY_URLS`: JSON array of proxy configurations
- `RATE_LIMIT_PER_MINUTE`: Requests per minute (default: 10)
- `RATE_LIMIT_PER_HOUR`: Requests per hour (default: 100)
- `DELAY_BETWEEN_REQUESTS`: Milliseconds between requests (default: 1000)
- `AUDIT_TABLE_NAME`: DynamoDB audit log table
- `VERIFICATION_QUEUE_TABLE_NAME`: DynamoDB verification queue table

## Compliance

### Robots.txt
- All scraping respects robots.txt directives
- User-Agent: `RoadcallBot/1.0 (+https://roadcall.example.com/bot)`
- Crawl-delay honored
- Disallowed paths skipped

### Rate Limiting
- Default: 10 requests/minute, 100 requests/hour
- Configurable per source
- Automatic backoff on rate limit errors

### Data Provenance
All collected data includes:
- Source URL
- Collection timestamp
- Collector ID
- IP address (proxy)
- User agent
- Robots.txt compliance status
- Legal flags

### Circuit Breaker
- Opens at 10% error rate
- Halts all collection
- Requires manual review
- Automatic recovery after timeout

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test --coverage

# Type check
pnpm typecheck
```

## Deployment

The service is deployed as Lambda functions with:
- 1024 MB memory
- 5-minute timeout
- VPC configuration for proxy access
- IAM roles for DynamoDB access

## Monitoring

### CloudWatch Metrics
- Scraping success rate
- Circuit breaker state
- Rate limit hits
- Proxy failures
- Verification queue depth

### CloudWatch Alarms
- Circuit breaker opened
- High error rate (>5%)
- Verification queue backlog (>100 items)
- All proxies failed

## Legal Considerations

This service is designed for collecting publicly available vendor information only. Users must:

1. Ensure compliance with local laws and regulations
2. Respect website terms of service
3. Only collect publicly available data
4. Implement manual verification before use
5. Maintain audit logs for compliance

## Requirements Satisfied

- ✅ 17.1: Robots.txt compliance and rate limiting
- ✅ 17.2: Complete audit logging with data provenance
- ✅ 17.3: Manual verification queue
- ✅ 17.4: Circuit breaker at 10% error threshold
- ✅ 17.5: IP rotation via proxy services
