# Circuit Breaker Quick Reference

## Import

```typescript
import {
  // Circuit Breakers
  CircuitBreaker,
  stripeCircuitBreaker,
  weatherApiCircuitBreaker,
  locationServiceCircuitBreaker,
  
  // Health Checks
  HealthCheckManager,
  createHealthCheckHandler,
  createDynamoDBHealthCheck,
  createEnvVarHealthCheck,
  
  // Service Discovery
  createServiceDiscovery,
  ServiceLocator,
} from '@roadcall/utils';
```

## Quick Start

### 1. Use Pre-configured Circuit Breaker

```typescript
// Stripe API call
const result = await stripeCircuitBreaker.execute(async () => {
  return await stripe.paymentIntents.create(data);
});
```

### 2. Create Custom Circuit Breaker

```typescript
const myBreaker = new CircuitBreaker({
  name: 'my-service',
  failureThreshold: 0.5,    // 50%
  minimumRequests: 10,
  timeout: 30000,           // 30s
  resetTimeout: 60000,      // 60s
  fallback: async () => getCachedData(),
});

await myBreaker.execute(async () => {
  return await myService.call();
});
```

### 3. Add Health Checks

```typescript
const healthManager = new HealthCheckManager({
  serviceName: 'my-service',
  version: '1.0.0',
  checks: [
    createEnvVarHealthCheck(['TABLE_NAME', 'API_KEY']),
    createDynamoDBHealthCheck('MyTable'),
  ],
});

const handlers = createHealthCheckHandler(healthManager);
export const health = handlers.health;
```

### 4. Register with Cloud Map

```typescript
const serviceDiscovery = await createServiceDiscovery({
  namespaceId: process.env.CLOUD_MAP_NAMESPACE_ID!,
  serviceName: 'my-service',
  instanceId: process.env.INSTANCE_ID!,
  healthCheckUrl: '/health/readiness',
});
```

### 5. Discover Services

```typescript
const locator = new ServiceLocator(60000);
const instance = await locator.getServiceInstance(
  'other-service',
  namespaceId
);
```

## Pre-configured Circuit Breakers

| Service | Circuit Breaker | Fallback |
|---------|----------------|----------|
| Stripe | `stripeCircuitBreaker` | Queue for manual processing |
| Weather API | `weatherApiCircuitBreaker` | Return null |
| Location Service | `locationServiceCircuitBreaker` | Use cached data |
| Kendra | `kendraCircuitBreaker` | Empty results |
| Bedrock | `bedrockCircuitBreaker` | Basic response |
| Fraud Detector | `fraudDetectorCircuitBreaker` | Manual review |

## Health Check Endpoints

```
GET /health/liveness   -> 200 (service running)
GET /health/readiness  -> 200/503 (ready for traffic)
GET /health            -> 200/503 (detailed status)
```

## Circuit States

- **CLOSED**: Normal operation ✅
- **OPEN**: Failing fast, using fallback ⚠️
- **HALF_OPEN**: Testing recovery 🔄

## Monitoring

```typescript
// Get circuit breaker stats
const stats = myBreaker.getStats();
console.log(stats.state);        // Current state
console.log(stats.failureRate);  // Failure percentage
console.log(stats.totalRequests);// Total requests

// Get all circuit breaker stats
import { getAllCircuitBreakerStats } from '@roadcall/utils';
const allStats = getAllCircuitBreakerStats();
```

## Error Handling

```typescript
try {
  await myBreaker.execute(async () => {
    return await externalService.call();
  });
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Circuit is open, use fallback
    return fallbackData;
  }
  throw error;
}
```

## Best Practices

1. ✅ Set appropriate thresholds (50% for critical, 30% for non-critical)
2. ✅ Always implement fallback mechanisms
3. ✅ Monitor circuit state with CloudWatch
4. ✅ Use health checks for all services
5. ✅ Register services with Cloud Map
6. ✅ Test circuit breakers in staging
7. ✅ Log all circuit state transitions

## Common Patterns

### Pattern 1: External API with Cache Fallback

```typescript
const apiBreaker = new CircuitBreaker({
  name: 'external-api',
  fallback: async () => await cache.get('api-data'),
});
```

### Pattern 2: Queue for Later Processing

```typescript
const queueBreaker = new CircuitBreaker({
  name: 'payment-processor',
  fallback: async () => {
    await queue.add(paymentData);
    return { queued: true };
  },
});
```

### Pattern 3: Degraded Functionality

```typescript
const featureBreaker = new CircuitBreaker({
  name: 'ai-service',
  fallback: async () => ({
    result: basicProcessing(data),
    degraded: true,
  }),
});
```

## Troubleshooting

**Circuit keeps opening?**
- Check service health
- Review failure threshold
- Verify timeout settings
- Check network connectivity

**Fallback not working?**
- Verify fallback function is defined
- Check fallback function doesn't throw
- Review fallback logic

**Health checks failing?**
- Verify dependencies are accessible
- Check environment variables
- Review timeout settings
- Check IAM permissions

## Need More Help?

See full documentation: `packages/utils/CIRCUIT_BREAKER_GUIDE.md`
