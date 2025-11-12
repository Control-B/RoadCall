# Event-Driven Architecture

## Overview

The Roadcall platform uses AWS EventBridge as the central event bus for asynchronous, event-driven communication between microservices. This architecture enables loose coupling, independent scaling, and resilient service interactions.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Event Producers                          │
├─────────────┬──────────────┬──────────────┬────────────────────┤
│ incident-svc│  match-svc   │ tracking-svc │  payments-svc      │
│ telephony   │  vendor-svc  │  auth-svc    │  kb-svc            │
└──────┬──────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │             │              │                │
       └─────────────┴──────────────┴────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   EventBridge Event Bus │
              │  roadcall-events-{env}  │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌──────────────┐
│  Event Rules  │  │ Event Archive │  │ CloudWatch   │
│   (Routing)   │  │  (90 days)    │  │    Logs      │
└───────┬───────┘  └───────────────┘  └──────────────┘
        │
        ├─────────────────┬─────────────────┬──────────────────┐
        │                 │                 │                  │
        ▼                 ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Notifications│  │   Matching   │  │   Payments   │  │  Reporting   │
│     Queue    │  │    Queue     │  │    Queue     │  │    Queue     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       │ (DLQ: 3 retries)│                 │                 │
       ▼                 ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Notification │  │    Match     │  │   Payment    │  │  Reporting   │
│   Lambda     │  │   Lambda     │  │   Lambda     │  │   Lambda     │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

## Event Flow Examples

### 1. Incident Creation Flow

```
Driver creates incident
        │
        ▼
┌─────────────────┐
│  incident-svc   │ Publishes: IncidentCreated
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  EventBridge    │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  Match   │      │Reporting │      │   Logs   │
   │  Queue   │      │  Queue   │      │          │
   └────┬─────┘      └──────────┘      └──────────┘
        │
        ▼
   ┌──────────┐
   │  Match   │ Finds vendors, creates offers
   │ Service  │
   └────┬─────┘
        │
        ▼ Publishes: OfferCreated (x3)
   ┌──────────┐
   │EventBridge│
   └────┬─────┘
        │
        ▼
   ┌──────────┐
   │Notification│ Sends push/SMS to vendors
   │  Queue   │
   └──────────┘
```

### 2. Vendor Acceptance Flow

```
Vendor accepts offer
        │
        ▼
┌─────────────────┐
│   match-svc     │ Publishes: OfferAccepted
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  EventBridge    │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │Notification│    │ incident │      │Reporting │
   │  Queue   │      │  -svc    │      │  Queue   │
   └────┬─────┘      └────┬─────┘      └──────────┘
        │                 │
        ▼                 ▼
   Notify driver    Update incident status
                    Publish: IncidentAssigned
                           │
                           ▼
                    ┌──────────┐
                    │ tracking │ Start tracking session
                    │  -svc    │
                    └──────────┘
```

### 3. Work Completion Flow

```
Vendor completes work
        │
        ▼
┌─────────────────┐
│  incident-svc   │ Publishes: WorkCompleted
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  EventBridge    │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │Notification│    │ Payment  │      │Reporting │
   │  Queue   │      │  Queue   │      │  Queue   │
   └────┬─────┘      └────┬─────┘      └──────────┘
        │                 │
        ▼                 ▼
   Notify driver    Create payment record
                    Route to approval queue
```

## Event Schemas

All events follow a consistent structure defined in `@roadcall/events`:

```typescript
{
  Source: 'roadcall.{service}',
  DetailType: '{EventName}',
  Detail: {
    eventId: string,        // Auto-generated UUID
    timestamp: string,      // ISO 8601 timestamp
    version: string,        // Schema version (default: '1.0')
    ...eventSpecificFields
  },
  Resources: string[],      // Optional ARNs
  Time: Date
}
```

### Event Categories

#### Incident Events
- `IncidentCreated` - New incident created
- `IncidentStatusChanged` - Status updated
- `IncidentAssigned` - Vendor assigned
- `IncidentCancelled` - Incident cancelled
- `IncidentEscalated` - Escalated to dispatcher

#### Offer Events
- `OfferCreated` - Job offer sent to vendor
- `OfferAccepted` - Vendor accepted
- `OfferDeclined` - Vendor declined
- `OfferExpired` - Offer timed out

#### Work Events
- `WorkStarted` - Vendor started work
- `WorkCompleted` - Work finished

#### Payment Events
- `PaymentCreated` - Payment record created
- `PaymentApproved` - Approved by back office
- `PaymentCompleted` - Successfully processed
- `PaymentFailed` - Processing failed
- `PaymentFlagged` - Flagged for fraud

#### Tracking Events
- `TrackingStarted` - Session started
- `TrackingUpdated` - Location/ETA updated
- `TrackingStopped` - Session ended
- `VendorArrived` - Vendor at location

## Event Routing Rules

| Event Pattern | Target Queue | Purpose |
|--------------|--------------|---------|
| `roadcall.incident` + `IncidentCreated` | match-queue | Trigger vendor matching |
| `roadcall.match` + `Offer*` | notifications-queue | Notify vendors of offers |
| `roadcall.incident` + `IncidentStatusChanged` | notifications-queue | Notify drivers of updates |
| `roadcall.incident` + `WorkCompleted` | payment-approval-queue | Create payment record |
| `roadcall.payment` + `Payment*` | notifications-queue | Payment confirmations |
| `roadcall.*` (all events) | reporting-queue | Analytics and reporting |
| `roadcall.*` (all events) | CloudWatch Logs | Debugging and audit |

## Retry and Error Handling

### SQS Queue Configuration

All queues are configured with:
- **Visibility Timeout**: 300 seconds (5 minutes)
- **Message Retention**: 4 days
- **Max Receive Count**: 3 (retry 3 times)
- **Dead Letter Queue**: Enabled for all queues
- **Encryption**: KMS-managed encryption

### Retry Strategy

1. **First Attempt**: Immediate processing
2. **Second Attempt**: After visibility timeout (5 min)
3. **Third Attempt**: After visibility timeout (5 min)
4. **DLQ**: After 3 failed attempts

### Dead Letter Queue Monitoring

- CloudWatch alarms trigger when messages appear in DLQ
- DLQ messages retained for 14 days
- Manual investigation and replay required

## Event Replay

### Archive Configuration

- **Archive Name**: `roadcall-events-archive-{env}`
- **Retention**: 90 days (prod), 30 days (dev)
- **Pattern**: All events with source `roadcall.*`

### Replay Use Cases

1. **Bug Recovery**: Replay events after fixing a bug
2. **Data Recovery**: Restore lost data from events
3. **Testing**: Replay production events in staging
4. **Debugging**: Investigate issues by replaying specific time ranges

### Replay Process

```bash
# 1. Start replay
ts-node infrastructure/scripts/replay-events.ts start \
  --archive roadcall-events-archive-prod \
  --start "2024-01-15T00:00:00Z" \
  --end "2024-01-15T23:59:59Z" \
  --event-bus arn:aws:events:us-east-1:123456789012:event-bus/roadcall-events-prod \
  --replay-name incident-recovery

# 2. Monitor progress
ts-node infrastructure/scripts/replay-events.ts status \
  --replay incident-recovery

# 3. Wait for completion
ts-node infrastructure/scripts/replay-events.ts status \
  --replay incident-recovery --wait

# 4. Cancel if needed
ts-node infrastructure/scripts/replay-events.ts cancel \
  --replay incident-recovery
```

## Best Practices

### Publishing Events

1. **Use typed publishers**: Always use service-specific helper functions
   ```typescript
   import { publishIncidentCreated } from './events';
   await publishIncidentCreated({ ... });
   ```

2. **Include resource ARNs**: Add relevant resources for filtering
   ```typescript
   resources: [`incident/${incidentId}`, `vendor/${vendorId}`]
   ```

3. **Keep events immutable**: Never modify published events
4. **Version schemas**: Use version field for schema evolution
5. **Publish after commit**: Only publish events after database writes succeed

### Consuming Events

1. **Idempotent handlers**: Handle duplicate events gracefully
   ```typescript
   // Check if already processed
   const existing = await getProcessedEvent(eventId);
   if (existing) return;
   ```

2. **Validate event structure**: Always validate incoming events
3. **Handle failures gracefully**: Log errors and let retry mechanism work
4. **Monitor DLQs**: Set up alerts for dead letter queues
5. **Use structured logging**: Include eventId in all logs

### Testing

1. **Unit test publishers**: Mock EventBridge client
2. **Integration test consumers**: Use LocalStack or test events
3. **Test idempotency**: Verify duplicate event handling
4. **Test error scenarios**: Verify DLQ behavior

## Monitoring and Observability

### CloudWatch Metrics

- `NumberOfMessagesSent` - Events published to queues
- `NumberOfMessagesReceived` - Events consumed from queues
- `ApproximateAgeOfOldestMessage` - Queue backlog age
- `ApproximateNumberOfMessagesVisible` - Queue depth

### CloudWatch Alarms

- DLQ message count > 0
- Queue age > 5 minutes
- Failed invocations > 10 per minute

### X-Ray Tracing

All event publishers and consumers are instrumented with X-Ray for distributed tracing.

### CloudWatch Logs

All events are logged to CloudWatch Logs for debugging:
- Log Group: `/aws/events/roadcall-{env}`
- Retention: 1 year (prod), 1 month (dev)

## Security

### Encryption

- **In Transit**: TLS 1.3 for all EventBridge communication
- **At Rest**: KMS-managed encryption for SQS queues
- **Event Data**: Sensitive data encrypted before publishing

### IAM Permissions

- **Publishers**: `events:PutEvents` on event bus
- **Consumers**: `sqs:ReceiveMessage`, `sqs:DeleteMessage` on queues
- **Replay**: `events:StartReplay`, `events:DescribeReplay` on archive

### Audit Trail

- All events logged to CloudWatch Logs
- CloudTrail captures all EventBridge API calls
- Event archive provides 90-day history

## Performance

### Throughput

- EventBridge: 10,000 events/second per account
- SQS: Unlimited throughput
- Lambda: Auto-scales to handle queue depth

### Latency

- Event publishing: < 50ms P99
- Event routing: < 100ms P99
- End-to-end (publish to consume): < 500ms P99

### Cost Optimization

- Use SQS for buffering (cheaper than direct Lambda invocation)
- Batch process events where possible
- Archive only necessary events
- Set appropriate retention periods

## Troubleshooting

### Events Not Being Delivered

1. Check EventBridge rule is enabled
2. Verify event pattern matches published events
3. Check SQS queue permissions
4. Review CloudWatch Logs for errors

### High DLQ Message Count

1. Check Lambda function logs for errors
2. Verify event schema matches consumer expectations
3. Check for transient errors (database timeouts, etc.)
4. Consider increasing visibility timeout

### Replay Not Working

1. Verify archive contains events for time range
2. Check replay status for errors
3. Ensure event bus ARN is correct
4. Verify IAM permissions for replay

## Migration Guide

### Adding New Event Types

1. Add event schema to `packages/events/src/schemas.ts`
2. Add event type constant to `EventTypes`
3. Create publisher function in service
4. Add EventBridge rule if needed
5. Update documentation

### Modifying Existing Events

1. **Non-breaking changes**: Add optional fields
2. **Breaking changes**: Create new event version
   ```typescript
   detail: {
     version: '2.0',  // Increment version
     ...
   }
   ```
3. Support both versions during transition
4. Deprecate old version after migration

## References

- [AWS EventBridge Documentation](https://docs.aws.amazon.com/eventbridge/)
- [Event-Driven Architecture Patterns](https://aws.amazon.com/event-driven-architecture/)
- [@roadcall/events Package](./packages/events/README.md)
- [EventBridge Stack](./infrastructure/lib/eventbridge-stack.ts)
