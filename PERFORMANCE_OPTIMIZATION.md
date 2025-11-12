# Performance Optimization Implementation

## Overview

This document describes the performance optimization and caching implementations for the AI Roadcall Assistant platform, addressing requirements 25.1, 25.4, and 25.5.

## Components Implemented

### 1. ElastiCache Redis Cluster

**Purpose**: Vendor profile caching and geospatial indexing

**Configuration**:
- Node type: `cache.t3.medium`
- Engine: Redis 7.0
- Deployment: Single-AZ (can be upgraded to Multi-AZ for production)
- TTL: 5 minutes (300 seconds) for vendor profiles
- Snapshot retention: 5 days
- Automatic minor version upgrades enabled

**Features**:
- Vendor profile caching with automatic expiration
- Geospatial indexing using Redis GEOADD/GEORADIUS
- Availability tracking with hash sets
- Search result caching (1-minute TTL)

**Usage**:
```typescript
import { getVendorCache } from './cache-service';

const cache = await getVendorCache();

// Cache vendor profile
await cache.cacheVendor(vendor);

// Search vendors nearby
const results = await cache.searchVendorsNearby(
  latitude,
  longitude,
  radiusMiles,
  { capabilities: ['tire_repair'], availableOnly: true }
);
```

### 2. CloudFront CDN Distribution

**Purpose**: Static asset delivery and API caching

**Configuration**:
- Price class: 100 (North America and Europe)
- Minimum TLS: 1.2
- Compression: Enabled (Gzip and Brotli)
- Logging: Enabled

**Cache Policies**:
- Static assets: CACHING_OPTIMIZED (long TTL)
- API endpoints: Custom policy (0-300 seconds TTL)

**Behaviors**:
- `/api/*`: API Gateway origin with custom caching
- `/*`: S3 origin for static assets

### 3. DynamoDB DAX Cluster

**Purpose**: Hot data acceleration for frequently accessed DynamoDB items

**Configuration**:
- Node type: `dax.t3.small`
- Replication factor: 1 (can be increased for HA)
- Encryption: SSE enabled
- Port: 8111

**Supported Tables**:
- Incidents table
- Vendors table
- Tracking sessions table

**Benefits**:
- Microsecond read latency
- Reduces DynamoDB read capacity consumption
- Transparent caching (no code changes required)

### 4. Aurora Connection Pooling

**Purpose**: Efficient database connection management for Lambda functions

**Configuration**:
- Min connections: 2
- Max connections: 10
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds
- Statement timeout: 30 seconds

**Features**:
- Automatic retry on transient errors
- Connection reuse across Lambda invocations
- Health checks
- Graceful shutdown
- Pool statistics monitoring

**Usage**:
```typescript
import { getDatabase } from './database';

const db = getDatabase();

// Execute query with automatic retry
const result = await db.query(
  'SELECT * FROM payments WHERE incident_id = $1',
  [incidentId],
  { retries: 3 }
);

// Execute transaction
await db.transaction(async (client) => {
  await client.query('INSERT INTO payments ...');
  await client.query('INSERT INTO payment_line_items ...');
});
```

### 5. AppSync Caching

**Purpose**: Cache GraphQL query results for tracking data

**Configuration**:
- Caching behavior: PER_RESOLVER_CACHING
- Cache type: T2_SMALL
- TTL: 5 seconds
- Transit encryption: Enabled
- At-rest encryption: Enabled

**Cached Resolvers**:
- `getTrackingSession`
- `getActiveSessionByIncident`

### 6. Lambda Function Warming

**Purpose**: Reduce cold start latency

**Configuration**:
- Warming interval: Every 5 minutes
- Concurrency per function: 3
- Timeout: 60 seconds

**How it works**:
1. EventBridge rule triggers warmer Lambda every 5 minutes
2. Warmer invokes configured functions with `{ warmer: true }` payload
3. Functions detect warmer payload and return immediately
4. Keeps Lambda execution contexts warm

**Adding functions to warmer**:
```typescript
performanceStack.addFunctionToWarmer(myFunction.functionName);
```

## Performance Metrics

### Target Latencies (Requirements 25.1)

| Operation | P95 Target | P99 Target |
|-----------|------------|------------|
| Incident creation | < 300ms | < 500ms |
| Vendor search | < 200ms | < 400ms |
| Get vendor profile | < 100ms | < 200ms |
| Location update | < 150ms | < 300ms |

### Cache Hit Rates

Target cache hit rates:
- Vendor profiles: > 80%
- Vendor search results: > 60%
- Tracking queries: > 70%

### Connection Pool Utilization

Monitor pool statistics:
```typescript
const stats = getDatabaseStats();
console.log({
  total: stats.totalCount,
  idle: stats.idleCount,
  waiting: stats.waitingCount,
});
```

Target utilization: 50-80% of max connections

## Deployment

### Infrastructure Deployment

```bash
cd infrastructure
pnpm cdk deploy PerformanceStack --context stage=dev
```

### Environment Variables

Add to Lambda functions:

```typescript
environment: {
  REDIS_HOST: performanceStack.redisEndpoint,
  REDIS_PORT: '6379',
  DB_HOST: dataStack.auroraCluster.clusterEndpoint.hostname,
  DB_PORT: '5432',
  DB_NAME: 'roadcall',
  DB_USER: 'admin',
  DB_PASSWORD: secretsManager.getSecretValue('db-password'),
}
```

## Monitoring

### CloudWatch Metrics

**Redis Metrics**:
- `CacheHits` / `CacheMisses`
- `CPUUtilization`
- `NetworkBytesIn` / `NetworkBytesOut`
- `CurrConnections`

**DAX Metrics**:
- `ItemCacheHits` / `ItemCacheMisses`
- `QueryCacheHits` / `QueryCacheMisses`
- `CPUUtilization`

**CloudFront Metrics**:
- `Requests`
- `BytesDownloaded`
- `4xxErrorRate` / `5xxErrorRate`
- `CacheHitRate`

**Custom Metrics**:
- Database connection pool utilization
- Cache hit rates by operation
- Lambda warm start vs cold start ratio

### Alarms

Set up CloudWatch alarms for:
- Redis CPU > 75%
- Cache hit rate < 60%
- Database connection pool exhaustion
- CloudFront 5xx error rate > 1%

## Load Testing

### Running Load Tests

```bash
cd tests/load
./run-load-test.sh staging full
```

### Test Scenarios

1. **Full Load Test**: Mixed workload (100-500 req/s)
2. **Incident Load Test**: 1000 concurrent incidents
3. **Quick Smoke Test**: Basic health check

See `tests/load/README.md` for details.

## Optimization Best Practices

### 1. Cache Invalidation

Invalidate cache when data changes:

```typescript
// After updating vendor
await cache.invalidateVendor(vendorId);

// After bulk update
await cache.invalidateVendors(vendorIds);
```

### 2. Cache Warming

Pre-populate cache for frequently accessed data:

```typescript
// Warm cache with top vendors
const topVendors = await getTopVendors();
await Promise.all(
  topVendors.map(v => cache.cacheVendor(v))
);
```

### 3. Query Optimization

Use DAX for hot data:
- Incident lookups by ID
- Vendor profile queries
- Active tracking sessions

Use Redis for:
- Geospatial searches
- Availability checks
- Search result caching

### 4. Connection Management

Reuse database connections:
```typescript
// Good: Reuse pool
const db = getDatabase();
await db.query(...);

// Bad: Create new pool per request
const pool = new Pool(...);
```

### 5. Lambda Optimization

- Set appropriate memory (1024MB recommended)
- Use provisioned concurrency for critical functions
- Implement graceful degradation when cache unavailable

## Troubleshooting

### High Cache Miss Rate

1. Check TTL settings (may be too short)
2. Verify cache warming is working
3. Review invalidation logic (may be too aggressive)
4. Check Redis memory usage

### Database Connection Exhaustion

1. Increase max connections in pool
2. Reduce connection timeout
3. Check for connection leaks
4. Review query performance

### High Latency

1. Check cache hit rates
2. Review database query plans
3. Verify Lambda is warmed
4. Check network connectivity

### Redis Connection Errors

1. Verify security group rules
2. Check Redis cluster health
3. Review connection timeout settings
4. Ensure Lambda is in correct VPC

## Future Enhancements

1. **Multi-AZ Redis**: Deploy Redis in multiple AZs for HA
2. **Read Replicas**: Add Aurora read replicas for reporting
3. **Global Accelerator**: Use AWS Global Accelerator for multi-region
4. **ElastiCache Cluster Mode**: Enable cluster mode for horizontal scaling
5. **Provisioned Concurrency**: Add to critical Lambda functions
6. **DynamoDB Global Tables**: For multi-region active-active

## References

- [ElastiCache Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
- [DynamoDB DAX](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html)
- [CloudFront Caching](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ConfiguringCaching.html)
- [Aurora Connection Management](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.BestPractices.html)
