# Circuit Breaker Pattern Implementation Guide

This guide explains how to use the circuit breaker pattern for resilient microservices in the AI Roadcall Assistant platform.

## Overview

The circuit breaker pattern prevents cascading failures by monitoring service health and providing fallback mechanisms when external services are unavailable.

### Circuit States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service is failing, requests fail fast (uses fallback if available)
- **HALF_OPEN**: Testing if service has recovered

## Basic Usage

### 1. Using Pre-configured Circuit Breakers

```typescript
import { stripeCircuitBreaker, weatherApiCircuitBreaker } from '@roadcall/utils';

// Stripe API call with circuit breaker
async function processPayment(paymentData: PaymentData) {
  try {
    const result = await stripeCircuitBreaker.execute(async () => {
      return await stripe.paymentIntents.create(paymentData);
    });
    return result;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      // Circuit is open, payment will be queued
      return { status: 'queued', message: 'Payment queued for processing' };
    }
    throw error;
  }
}

// Weather API call with circuit breaker
async function getWeatherData(location: Location) {
  try {
    const weather = await weatherApiCircuitBreaker.execute(async () => {
      return await weatherApi.getCurrentWeather(location);
    });
    return weather;
  } catch (error) {
    // Fallback returns null, incident can proceed without weather
    return null;
  }
}
```

### 2. Creating Custom Circuit Breakers

```typescript
import { CircuitBreaker, createExternalServiceCircuitBreaker } from '@roadcall/utils';

// Simple circuit breaker
const myServiceBreaker = new CircuitBreaker({
  name: 'my-service',
  failureThreshold: 0.5,      // 50% failure rate
  minimumRequests: 10,         // Minimum requests before evaluating
  timeout: 30000,              // 30 second timeout
  resetTimeout: 60000,         // 60 seconds before retry
});

// Circuit breaker with fallback
const myServiceWithFallback = createExternalServiceCircuitBreaker(
  'my-service',
  async () => {
    // Fallback logic - return cached data
    return await getCachedData();
  }
);

// Use the circuit breaker
async function callMyService(data: any) {
  return myServiceBreaker.execute(async () => {
    return await myService.call(data);
  });
}
```

### 3. Advanced Configuration

```typescript
import { CircuitBreaker, CircuitState } from '@roadcall/utils';

const advancedBreaker = new CircuitBreaker({
  name: 'advanced-service',
  failureThreshold: 0.3,       // Open at 30% failure rate
  minimumRequests: 20,         // Need 20 requests before evaluation
  timeout: 15000,              // 15 second timeout
  resetTimeout: 120000,        // 2 minutes before retry
  fallback: async () => {
    // Custom fallback logic
    logger.warn('Using fallback for advanced-service');
    return { degraded: true, data: await getBackupData() };
  },
});

// Monitor circuit breaker state
const stats = advancedBreaker.getStats();
console.log('Circuit State:', stats.state);
console.log('Failure Rate:', stats.failureRate);
console.log('Total Requests:', stats.totalRequests);

// Manual control (for testing/maintenance)
advancedBreaker.open();  // Manually open circuit
advancedBreaker.close(); // Manually close circuit
```

## Health Checks

### 1. Basic Health Check Setup

```typescript
import {
  HealthCheckManager,
  createHealthCheckHandler,
  createDynamoDBHealthCheck,
  createEnvVarHealthCheck,
  createMemoryHealthCheck,
} from '@roadcall/utils';

const healthManager = new HealthCheckManager({
  serviceName: 'my-service',
  version: '1.0.0',
  checks: [
    // Check required environment variables
    createEnvVarHealthCheck(['TABLE_NAME', 'API_KEY']),
    
    // Check memory usage
    createMemoryHealthCheck(90),
    
    // Check DynamoDB table
    createDynamoDBHealthCheck('MyTable'),
  ],
});

// Create Lambda handlers
const handlers = createHealthCheckHandler(healthManager);

export const liveness = handlers.liveness;
export const readiness = handlers.readiness;
export const health = handlers.health;
```

### 2. Custom Health Checks

```typescript
import { HealthCheck, HealthCheckManager } from '@roadcall/utils';

// Custom database health check
const dbHealthCheck: HealthCheck = {
  name: 'database-connection',
  check: async () => {
    try {
      await db.query('SELECT 1');
      return { healthy: true, message: 'Database connected' };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  },
  critical: true, // Service is unhealthy if this fails
};

// Custom external API health check
const apiHealthCheck: HealthCheck = {
  name: 'external-api',
  check: async () => {
    try {
      const response = await fetch('https://api.example.com/health');
      return {
        healthy: response.ok,
        message: `API status: ${response.status}`,
      };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  },
  critical: false, // Service can operate in degraded mode
};

const healthManager = new HealthCheckManager({
  serviceName: 'my-service',
  version: '1.0.0',
});

healthManager.registerCheck(dbHealthCheck);
healthManager.registerCheck(apiHealthCheck);
```

### 3. Health Check Endpoints

Add these routes to your API Gateway:

```typescript
// API Gateway routes
GET /health/liveness   -> liveness handler  (200 if running)
GET /health/readiness  -> readiness handler (200 if ready, 503 if not)
GET /health            -> health handler    (detailed status)
```

Example response:

```json
{
  "status": "healthy",
  "timestamp": "2024-11-11T10:30:00Z",
  "service": "payments-svc",
  "version": "1.0.0",
  "checks": {
    "environment-variables": {
      "status": "healthy",
      "message": "All required variables present",
      "responseTime": 2
    },
    "memory-usage": {
      "status": "healthy",
      "message": "Memory usage at 45.23%",
      "responseTime": 1
    },
    "database-connection": {
      "status": "healthy",
      "message": "Database connection successful",
      "responseTime": 156
    }
  },
  "circuitBreakers": {
    "stripe": {
      "state": "CLOSED",
      "failureCount": 0,
      "successCount": 142,
      "totalRequests": 142,
      "failureRate": 0
    }
  }
}
```

## Service Discovery

### 1. Register Service with AWS Cloud Map

```typescript
import { createServiceDiscovery } from '@roadcall/utils';

// Register service on startup
const serviceDiscovery = await createServiceDiscovery({
  namespaceId: process.env.CLOUD_MAP_NAMESPACE_ID!,
  serviceName: 'payments-svc',
  instanceId: process.env.INSTANCE_ID || `instance-${Date.now()}`,
  attributes: {
    version: '1.0.0',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  healthCheckUrl: '/health/readiness',
});

// Service will automatically deregister on shutdown (SIGTERM/SIGINT)
```

### 2. Discover Other Services

```typescript
import { ServiceLocator } from '@roadcall/utils';

const serviceLocator = new ServiceLocator(60000); // 60 second cache TTL

// Get a single instance (load balanced)
const instance = await serviceLocator.getServiceInstance(
  'vendor-svc',
  process.env.CLOUD_MAP_NAMESPACE_ID!
);

if (instance) {
  const url = `http://${instance.ipv4}:${instance.port}`;
  const response = await fetch(`${url}/vendors/search`);
}

// Get all instances
const instances = await serviceLocator.getServiceInstances(
  'vendor-svc',
  process.env.CLOUD_MAP_NAMESPACE_ID!
);

console.log(`Found ${instances.length} healthy instances`);
```

### 3. Update Health Status

```typescript
import { ServiceDiscoveryManager } from '@roadcall/utils';

const serviceDiscovery = new ServiceDiscoveryManager({
  namespaceId: process.env.CLOUD_MAP_NAMESPACE_ID!,
  serviceName: 'my-service',
  instanceId: process.env.INSTANCE_ID!,
});

// Update health status based on checks
const healthResult = await healthManager.executeHealthChecks();

if (healthResult.status === 'unhealthy') {
  await serviceDiscovery.updateHealthStatus('UNHEALTHY');
} else {
  await serviceDiscovery.updateHealthStatus('HEALTHY');
}
```

## Complete Service Example

```typescript
import {
  CircuitBreaker,
  HealthCheckManager,
  createHealthCheckHandler,
  createServiceDiscovery,
  createDynamoDBHealthCheck,
  createEnvVarHealthCheck,
  stripeCircuitBreaker,
  logger,
} from '@roadcall/utils';

// Initialize health checks
const healthManager = new HealthCheckManager({
  serviceName: 'payments-svc',
  version: process.env.SERVICE_VERSION || '1.0.0',
  checks: [
    createEnvVarHealthCheck(['TABLE_NAME', 'STRIPE_SECRET_KEY']),
    createDynamoDBHealthCheck(process.env.TABLE_NAME!),
  ],
});

// Register with Cloud Map
let serviceDiscovery: any;

async function startup() {
  try {
    serviceDiscovery = await createServiceDiscovery({
      namespaceId: process.env.CLOUD_MAP_NAMESPACE_ID!,
      serviceName: 'payments-svc',
      instanceId: process.env.INSTANCE_ID || `payments-${Date.now()}`,
      healthCheckUrl: '/health/readiness',
    });

    logger.info('Service registered with Cloud Map');
  } catch (error) {
    logger.error('Failed to register service', error);
  }
}

// Health check handlers
const healthHandlers = createHealthCheckHandler(healthManager);

export const liveness = healthHandlers.liveness;
export const readiness = healthHandlers.readiness;
export const health = healthHandlers.health;

// Business logic with circuit breaker
export async function processPayment(paymentData: any) {
  try {
    const result = await stripeCircuitBreaker.execute(async () => {
      return await stripe.paymentIntents.create(paymentData);
    });
    
    return { success: true, result };
  } catch (error) {
    logger.error('Payment processing failed', error);
    
    // Queue for manual processing if circuit is open
    if (error.name === 'CircuitBreakerOpenError') {
      await queuePaymentForManualProcessing(paymentData);
      return { success: false, queued: true };
    }
    
    throw error;
  }
}

// Start service
startup();
```

## Monitoring Circuit Breakers

### CloudWatch Metrics

```typescript
import { getAllCircuitBreakerStats } from '@roadcall/utils';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({});

// Publish circuit breaker metrics every minute
setInterval(async () => {
  const stats = getAllCircuitBreakerStats();
  
  for (const [name, stat] of Object.entries(stats)) {
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'RoadcallAssistant/CircuitBreakers',
      MetricData: [
        {
          MetricName: 'FailureRate',
          Value: stat.failureRate,
          Unit: 'Percent',
          Dimensions: [
            { Name: 'Service', Value: name },
            { Name: 'State', Value: stat.state },
          ],
        },
        {
          MetricName: 'TotalRequests',
          Value: stat.totalRequests,
          Unit: 'Count',
          Dimensions: [{ Name: 'Service', Value: name }],
        },
      ],
    }));
  }
}, 60000);
```

## Best Practices

1. **Set Appropriate Thresholds**: 
   - Use 50% failure rate for critical services
   - Use 30% for less critical services
   - Require minimum 10 requests before evaluation

2. **Implement Fallbacks**:
   - Return cached data when possible
   - Provide degraded functionality
   - Queue operations for later processing

3. **Monitor Circuit State**:
   - Publish metrics to CloudWatch
   - Set up alarms for OPEN circuits
   - Track failure rates and response times

4. **Test Circuit Breakers**:
   - Simulate failures in staging
   - Verify fallback mechanisms work
   - Test recovery (HALF_OPEN → CLOSED)

5. **Use Health Checks**:
   - Implement liveness and readiness probes
   - Check critical dependencies
   - Update service discovery health status

6. **Handle Timeouts**:
   - Set reasonable timeouts (30s default)
   - Don't wait indefinitely for responses
   - Log timeout events for investigation

7. **Graceful Degradation**:
   - Design services to work with partial data
   - Prioritize core functionality
   - Communicate degraded state to users
