# Observability and Monitoring Setup

This document describes the comprehensive observability and monitoring infrastructure for the AI Roadcall Assistant platform.

## Overview

The platform implements a complete observability stack with:

- **Structured JSON Logging**: All logs are output in JSON format for CloudWatch Logs Insights
- **Distributed Tracing**: AWS X-Ray for end-to-end request tracing
- **Custom Metrics**: Business KPIs and operational metrics in CloudWatch
- **Automated Alarms**: CloudWatch alarms for SLA violations and errors
- **Audit Trail**: CloudTrail for all AWS API calls with 7-year retention
- **Real-time Dashboards**: CloudWatch dashboards for system and business metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Lambda Functions                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  withObservability() Middleware                       │  │
│  │  - Structured Logging                                 │  │
│  │  - X-Ray Tracing                                      │  │
│  │  - Metrics Publishing                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│ CloudWatch Logs  │                  │ CloudWatch       │
│                  │                  │ Metrics          │
│ - JSON Logs      │                  │                  │
│ - Log Insights   │                  │ - Business KPIs  │
│ - 30-day retain  │                  │ - System Metrics │
└──────────────────┘                  │ - Custom Metrics │
        │                              └──────────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│ AWS X-Ray        │                  │ CloudWatch       │
│                  │                  │ Alarms           │
│ - Service Map    │                  │                  │
│ - Trace Analysis │                  │ - Latency > 300ms│
│ - Performance    │                  │ - Error Rate > 5%│
└──────────────────┘                  │ - Throttles      │
                                      └──────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │ SNS Topic        │
                                      │                  │
                                      │ - Email Alerts   │
                                      │ - Slack (future) │
                                      └──────────────────┘
```

## Components

### 1. Monitoring Stack (`monitoring-stack.ts`)

The central CDK stack that creates:

- **CloudTrail**: Audit logging for all AWS API calls
  - 7-year retention (Glacier after 90 days)
  - Log file validation enabled
  - Multi-region trail
  - CloudWatch Logs integration

- **SNS Alarm Topic**: Central notification hub
  - Email subscriptions for alerts
  - Can be extended with Slack, PagerDuty, etc.

- **CloudWatch Dashboard**: Real-time monitoring
  - System-wide error rates
  - API Gateway latency (P95, P99, Average)
  - Lambda invocations, errors, duration, throttles
  - Business KPIs (time to assign, acceptance rate, etc.)

- **CloudWatch Alarms**: Automated alerting
  - API latency > 300ms (P95)
  - 5XX error rate > 5%
  - Lambda errors > 5 in 5 minutes
  - Lambda throttles > 1
  - Time to assign > 60 seconds
  - Vendor acceptance rate < 50%

### 2. Structured Logger (`logger.ts`)

Provides structured JSON logging with:

```typescript
import { createLogger } from '@roadcall/utils';

const logger = createLogger('my-service', 'production');

// Log levels
logger.debug('Debug message', { key: 'value' });
logger.info('Info message', { userId: '123' });
logger.warn('Warning message', { reason: 'timeout' });
logger.error('Error occurred', error, { context: 'payment' });

// Performance logging
const timer = logger.startTimer('database-query');
await performQuery();
timer(); // Logs duration automatically

// Child logger with context
const requestLogger = logger.child({ requestId: '123', userId: 'user-456' });
requestLogger.info('Processing request'); // Includes requestId and userId
```

**Features**:
- Automatic PII redaction (passwords, tokens, SSN, etc.)
- X-Ray trace ID correlation
- Lambda context integration
- Configurable log levels via `LOG_LEVEL` env var
- Performance timing utilities

**Log Format**:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "Incident created successfully",
  "service": "incident-svc",
  "environment": "production",
  "requestId": "abc-123-def",
  "traceId": "1-5e645f3e-1234567890abcdef",
  "metadata": {
    "incidentId": "inc_123",
    "type": "tire",
    "durationMs": 245
  }
}
```

### 3. Metrics Publisher (`metrics.ts`)

Custom CloudWatch metrics for business KPIs:

```typescript
import { createBusinessMetrics } from '@roadcall/utils';

const metrics = createBusinessMetrics('roadcall-assistant', 'production');

// Record business events
await metrics.recordIncidentCreated('tire');
await metrics.recordTimeToAssign(45, 'tire'); // 45 seconds
await metrics.recordOfferAccepted('vendor-123');
await metrics.recordPaymentProcessed(15000, 'stripe'); // $150.00

// Flush before function exits
await metrics.flush();
```

**Available Metrics**:
- `IncidentsCreated` - Count of incidents by type
- `IncidentsCompleted` - Count of completed incidents
- `TimeToAssign` - Seconds to assign vendor
- `TimeToArrival` - Minutes for vendor to arrive
- `OffersCreated` - Count of offers sent
- `OffersAccepted` - Count of offers accepted
- `OffersDeclined` - Count of offers declined
- `ActiveIncidents` - Current active incident count
- `PaymentApprovalTime` - Minutes to approve payment
- `PaymentsProcessed` - Count and amount of payments
- `FraudScore` - Fraud detection scores

### 4. Lambda Middleware (`lambda-middleware.ts`)

Wraps Lambda handlers with observability:

```typescript
import { withObservability, EnhancedContext } from '@roadcall/utils';

export const handler = withObservability(
  {
    serviceName: 'incident-svc',
    environment: process.env.ENVIRONMENT,
    enableXRay: true,
    enableMetrics: true,
  },
  async (event, context: EnhancedContext) => {
    const { logger, metrics } = context;

    logger.info('Processing request', { eventType: event['detail-type'] });

    // Your handler logic here

    return { statusCode: 200, body: 'Success' };
  }
);
```

**Features**:
- Automatic request/response logging
- Duration tracking
- Error capture and metrics
- X-Ray subsegment creation
- Metrics buffering and flushing

### 5. X-Ray Tracing Utilities

```typescript
import { traceOperation, traceAWSCall, traceDbOperation } from '@roadcall/utils';

// Trace custom operations
await traceOperation('MatchVendors', async () => {
  return await findVendors(location, radius);
}, { location, radius });

// Trace AWS SDK calls
await traceAWSCall('DynamoDB', 'PutItem', async () => {
  return await dynamodb.putItem(params);
});

// Trace database operations
await traceDbOperation('Incidents', 'Query', async () => {
  return await queryIncidents(driverId);
});
```

### 6. Monitored Microservice Construct

CDK construct that creates a microservice with built-in monitoring:

```typescript
import { MonitoredMicroservice } from './constructs/monitored-microservice';

const service = new MonitoredMicroservice(this, 'IncidentService', {
  serviceName: 'incident-svc',
  environment: 'production',
  handlerPath: 'services/incident-svc/src',
  routes: [
    { path: '/incidents', method: 'POST', handler: 'create-incident.handler' },
    { path: '/incidents/{id}', method: 'GET', handler: 'get-incident.handler' },
  ],
  alarmTopic: monitoringStack.alarmTopic,
  enableXRay: true,
  logRetention: logs.RetentionDays.ONE_MONTH,
  alarmThresholds: {
    errorRate: 5,
    latencyP95: 300,
    throttleCount: 1,
  },
});
```

## Deployment

### 1. Deploy Monitoring Stack

```bash
cd infrastructure

# Deploy monitoring stack first
cdk deploy MonitoringStack \
  --context environment=production \
  --context alarmEmail=ops@example.com
```

### 2. Update Service Stacks

Update existing service stacks to use `MonitoredMicroservice`:

```typescript
// Before
const service = new MicroserviceApi(this, 'Service', { ... });

// After
const service = new MonitoredMicroservice(this, 'Service', {
  ...existingProps,
  alarmTopic: monitoringStack.alarmTopic,
});
```

### 3. Add Dependencies to Services

Update `package.json` for each service:

```json
{
  "dependencies": {
    "@roadcall/utils": "workspace:*",
    "aws-xray-sdk-core": "^3.5.0",
    "@aws-sdk/client-cloudwatch": "^3.450.0"
  }
}
```

Install dependencies:

```bash
pnpm install
```

### 4. Update Lambda Handlers

Wrap existing handlers with observability middleware:

```typescript
// Before
export async function handler(event: APIGatewayProxyEvent) {
  // Handler logic
}

// After
import { withObservability } from '@roadcall/utils';

export const handler = withObservability(
  { serviceName: 'my-service', environment: process.env.ENVIRONMENT },
  async (event, context) => {
    const { logger, metrics } = context;
    // Handler logic with logger and metrics
  }
);
```

## CloudWatch Logs Insights Queries

### Find All Errors

```
fields @timestamp, level, message, service, error.name, error.message
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

### Calculate P95 Latency by Service

```
fields @timestamp, service, metadata.durationMs
| filter metadata.performanceMetric = true
| stats pct(metadata.durationMs, 95) as p95_latency by service
```

### Count Incidents by Type

```
fields @timestamp, message, metadata.incidentType
| filter message = "Incident created successfully"
| stats count() by metadata.incidentType
```

### Find Slow Operations (> 1 second)

```
fields @timestamp, service, metadata.operation, metadata.durationMs
| filter metadata.performanceMetric = true and metadata.durationMs > 1000
| sort metadata.durationMs desc
| limit 50
```

### Track User Journey

```
fields @timestamp, message, metadata.userId, metadata.incidentId
| filter metadata.userId = "user-123"
| sort @timestamp asc
```

## X-Ray Service Map

Access the X-Ray service map to visualize:
- Service dependencies
- Request flow
- Latency distribution
- Error rates by service

URL: `https://console.aws.amazon.com/xray/home?region=us-east-1#/service-map`

## CloudWatch Dashboard

Access the main dashboard:

URL: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=roadcall-assistant-production`

**Widgets**:
1. System Error Rate (Lambda + API Gateway)
2. System Uptime (Last 24h)
3. API Latency (P95, P99, Average) per service
4. API Requests & Errors per service
5. Lambda Invocations
6. Lambda Errors
7. Lambda Duration (P95)
8. Lambda Throttles
9. Time to Assign (Business KPI)
10. Time to Arrival (Business KPI)
11. Vendor Acceptance Rate (Business KPI)
12. Active Incidents
13. Incident Resolution Rate
14. Payment Approval Time

## Alarms and Notifications

All alarms send notifications to the SNS topic. Configure email subscriptions:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:roadcall-assistant-production-alarms \
  --protocol email \
  --notification-endpoint ops@example.com
```

**Active Alarms**:
- `{service}-high-latency`: P95 latency > 300ms
- `{service}-high-error-rate`: 5XX error rate > 5%
- `{function}-errors`: Lambda errors > 5 in 5 minutes
- `{function}-throttles`: Lambda throttled
- `high-time-to-assign`: Time to assign > 60 seconds
- `low-vendor-acceptance-rate`: Acceptance rate < 50%

## Best Practices

### 1. Always Use Structured Logging

```typescript
// ❌ Bad
console.log('User logged in: ' + userId);

// ✅ Good
logger.info('User logged in', { userId, timestamp: new Date() });
```

### 2. Record Business Metrics

```typescript
// Record important business events
await metrics.recordIncidentCreated(type);
await metrics.recordTimeToAssign(duration, type);
```

### 3. Use Tracing for External Calls

```typescript
// Trace AWS SDK calls
await traceAWSCall('DynamoDB', 'GetItem', async () => {
  return await dynamodb.getItem(params);
});

// Trace HTTP calls
await traceHttpCall('https://api.stripe.com', 'POST', async () => {
  return await stripe.charges.create(params);
});
```

### 4. Flush Metrics Before Exit

```typescript
try {
  // Handler logic
} finally {
  await metrics.flush();
}
```

### 5. Add Context to Logs

```typescript
const requestLogger = logger.child({ requestId, userId });
requestLogger.info('Processing payment'); // Includes requestId and userId
```

### 6. Never Log Sensitive Data

The logger automatically redacts common sensitive fields, but be cautious:

```typescript
// ❌ Bad
logger.info('Payment details', { creditCard: '4111111111111111' });

// ✅ Good
logger.info('Payment processed', { paymentId: 'pay_123', last4: '1111' });
```

## Troubleshooting

### High Latency

1. Check X-Ray traces for slow operations
2. Review CloudWatch Logs for performance metrics
3. Check DynamoDB/Aurora metrics for throttling
4. Review Lambda cold start metrics

### High Error Rate

1. Filter CloudWatch Logs for ERROR level
2. Check X-Ray for failed traces
3. Review alarm history for patterns
4. Check service dependencies

### Missing Metrics

1. Verify metrics are being published: `await metrics.flush()`
2. Check CloudWatch Metrics namespace
3. Verify IAM permissions for `cloudwatch:PutMetricData`
4. Check Lambda timeout (metrics may not flush)

### X-Ray Traces Not Appearing

1. Verify `enableXRay: true` in middleware config
2. Check Lambda execution role has X-Ray permissions
3. Verify `aws-xray-sdk-core` is installed
4. Check X-Ray sampling rules

## Cost Optimization

- **CloudWatch Logs**: $0.50/GB ingested, $0.03/GB stored
- **CloudWatch Metrics**: $0.30 per custom metric
- **X-Ray**: $5.00 per 1M traces recorded, $0.50 per 1M traces scanned
- **CloudTrail**: $2.00 per 100,000 events

**Recommendations**:
- Use log retention policies (30 days default)
- Sample X-Ray traces (10% for normal traffic, 100% for errors)
- Buffer metrics before publishing (20 metrics per batch)
- Use metric filters instead of custom metrics where possible

## Future Enhancements

- [ ] Integrate with Slack for alarm notifications
- [ ] Add PagerDuty integration for on-call rotation
- [ ] Implement distributed tracing across mobile apps
- [ ] Add Grafana dashboards for advanced visualization
- [ ] Implement anomaly detection with CloudWatch Anomaly Detection
- [ ] Add synthetic monitoring with CloudWatch Synthetics
- [ ] Implement log aggregation with OpenSearch
- [ ] Add APM integration (Datadog, New Relic)
