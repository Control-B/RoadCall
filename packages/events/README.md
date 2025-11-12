# @roadcall/events

EventBridge event schemas, publishers, and utilities for the Roadcall platform.

## Overview

This package provides a centralized, type-safe way to publish and consume domain events across all microservices in the Roadcall platform. All events follow a consistent structure and are routed through AWS EventBridge.

## Features

- **Type-safe event schemas** - TypeScript interfaces for all domain events
- **Event publisher** - Simplified API for publishing events to EventBridge
- **Event replay** - Utilities for replaying events from archive
- **Consistent structure** - All events follow the same base structure
- **Automatic enrichment** - Events are automatically enriched with eventId, timestamp, and version

## Installation

```bash
pnpm add @roadcall/events
```

## Event Structure

All events follow this structure:

```typescript
{
  Source: 'roadcall.{service}',      // e.g., 'roadcall.incident'
  DetailType: '{EventName}',          // e.g., 'IncidentCreated'
  Detail: {
    eventId: string,                  // Unique event ID (auto-generated)
    timestamp: string,                // ISO 8601 timestamp (auto-generated)
    version: string,                  // Event schema version (default: '1.0')
    ...eventSpecificFields
  },
  Resources: ['arn:...'],             // Optional resource ARNs
  Time: Date                          // Event time
}
```

## Usage

### Publishing Events

```typescript
import { getEventPublisher, EventSources, EventTypes } from '@roadcall/events';

// Get the singleton publisher instance
const publisher = getEventPublisher();

// Publish an event
await publisher.publishEvent({
  source: EventSources.INCIDENT_SERVICE,
  detailType: EventTypes.INCIDENT_CREATED,
  detail: {
    incidentId: 'inc-123',
    driverId: 'drv-456',
    type: 'tire',
    location: { lat: 40.7128, lon: -74.0060 },
    phone: '+15551234567',
    priority: 'high',
  },
  resources: ['incident/inc-123'],
});
```

### Using Service-Specific Publishers

Each service has helper functions for publishing its events:

```typescript
// In incident-svc
import { publishIncidentCreated } from './events';

await publishIncidentCreated({
  incidentId: 'inc-123',
  driverId: 'drv-456',
  type: 'tire',
  location: { lat: 40.7128, lon: -74.0060 },
  phone: '+15551234567',
  priority: 'high',
});
```

### Batch Publishing

```typescript
import { getEventPublisher } from '@roadcall/events';

const publisher = getEventPublisher();

await publisher.publishEvents([
  {
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_CREATED,
    detail: { /* ... */ },
  },
  {
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_CREATED,
    detail: { /* ... */ },
  },
]);
```

### Event Replay

Replay events from the archive for debugging or recovery:

```typescript
import { getEventReplay } from '@roadcall/events';

const replay = getEventReplay();

// Start a replay
const replayArn = await replay.startReplay({
  archiveName: 'roadcall-events-archive-prod',
  replayName: 'incident-recovery-2024-01-15',
  eventSourceArn: 'arn:aws:events:us-east-1:123456789012:event-bus/roadcall-events-prod',
  startTime: new Date('2024-01-15T00:00:00Z'),
  endTime: new Date('2024-01-15T23:59:59Z'),
  description: 'Replay incidents from Jan 15 for recovery',
});

// Check replay status
const status = await replay.getReplayStatus('incident-recovery-2024-01-15');
console.log(status.state); // STARTING, RUNNING, COMPLETED, FAILED, CANCELLED

// Wait for completion
await replay.waitForReplayCompletion('incident-recovery-2024-01-15');

// Cancel if needed
await replay.cancelReplay('incident-recovery-2024-01-15');
```

### CLI Tool for Replay

Use the CLI tool for manual event replay:

```bash
# Start a replay
ts-node infrastructure/scripts/replay-events.ts start \
  --archive roadcall-events-archive-prod \
  --start "2024-01-15T00:00:00Z" \
  --end "2024-01-15T23:59:59Z" \
  --event-bus arn:aws:events:us-east-1:123456789012:event-bus/roadcall-events-prod \
  --replay-name incident-recovery

# Check status
ts-node infrastructure/scripts/replay-events.ts status --replay incident-recovery

# Wait for completion
ts-node infrastructure/scripts/replay-events.ts status --replay incident-recovery --wait

# List all replays
ts-node infrastructure/scripts/replay-events.ts list

# Cancel a replay
ts-node infrastructure/scripts/replay-events.ts cancel --replay incident-recovery
```

## Event Types

### Incident Events

- `IncidentCreated` - New incident created
- `IncidentStatusChanged` - Incident status updated
- `IncidentAssigned` - Vendor assigned to incident
- `IncidentCancelled` - Incident cancelled
- `IncidentEscalated` - Incident escalated to dispatcher

### Vendor Events

- `VendorRegistered` - New vendor registered
- `VendorStatusChanged` - Vendor availability changed
- `VendorLocationUpdated` - Vendor location updated
- `VendorArrived` - Vendor arrived at incident location

### Offer Events

- `OfferCreated` - Job offer sent to vendor
- `OfferAccepted` - Vendor accepted offer
- `OfferDeclined` - Vendor declined offer
- `OfferExpired` - Offer expired without response

### Tracking Events

- `TrackingStarted` - Real-time tracking session started
- `TrackingUpdated` - Vendor location/ETA updated
- `TrackingStopped` - Tracking session ended

### Work Events

- `WorkStarted` - Vendor started work on incident
- `WorkCompleted` - Vendor completed work

### Payment Events

- `PaymentCreated` - Payment record created
- `PaymentApproved` - Payment approved by back office
- `PaymentCompleted` - Payment processed successfully
- `PaymentFailed` - Payment processing failed
- `PaymentFlagged` - Payment flagged for fraud review

### Call Events

- `CallStarted` - Phone call started
- `CallEnded` - Phone call ended
- `TranscriptReady` - Call transcription completed
- `CallSummaryGenerated` - AI summary generated

### User Events

- `UserRegistered` - New user registered
- `UserVerified` - User phone verified

### Knowledge Base Events

- `DocumentUploaded` - Document uploaded to KB
- `DocumentIndexed` - Document indexed in Kendra

## Event Routing

Events are automatically routed to target services via EventBridge rules:

| Event | Target Services |
|-------|----------------|
| IncidentCreated | Match Service (SQS), Reporting |
| OfferCreated | Notifications (SQS), Reporting |
| OfferAccepted | Notifications (SQS), Reporting |
| IncidentStatusChanged | Notifications (SQS), Reporting |
| VendorArrived | Notifications (SQS), Reporting |
| WorkCompleted | Notifications (SQS), Payments (SQS), Reporting |
| PaymentCompleted | Notifications (SQS), Reporting |
| All Events | Reporting (SQS), CloudWatch Logs |

## Retry and Error Handling

- **SQS Queues**: All event targets use SQS queues for buffering and retry
- **Retry Policy**: 3 attempts with exponential backoff
- **Dead Letter Queues**: Failed events after 3 retries go to DLQ
- **CloudWatch Alarms**: DLQ messages trigger alarms for investigation
- **Event Archive**: All events archived for 90 days (prod) / 30 days (dev)

## Environment Variables

```bash
# Event bus name (optional, defaults to 'roadcall-events')
EVENT_BUS_NAME=roadcall-events-prod

# AWS region (optional, uses default region)
AWS_REGION=us-east-1
```

## Best Practices

1. **Always use typed event publishers** - Use service-specific helper functions
2. **Include resource ARNs** - Add relevant resource ARNs for filtering
3. **Keep events immutable** - Never modify event schemas in breaking ways
4. **Version your events** - Use the version field for schema evolution
5. **Test event handlers** - Write integration tests for event consumers
6. **Monitor DLQs** - Set up alerts for dead letter queue messages
7. **Use replay for recovery** - Replay events after fixing bugs or outages

## Testing

```typescript
import { EventPublisher } from '@roadcall/events';

// Mock EventBridge client for testing
jest.mock('@aws-sdk/client-eventbridge');

describe('Event Publishing', () => {
  it('should publish incident created event', async () => {
    const publisher = new EventPublisher('test-bus');
    
    await publisher.publishEvent({
      source: 'roadcall.incident',
      detailType: 'IncidentCreated',
      detail: {
        incidentId: 'test-123',
        // ...
      },
    });
    
    // Assert EventBridge client was called
  });
});
```

## Architecture

```
┌─────────────┐
│  Services   │
│ (Publishers)│
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  EventBridge    │
│   Event Bus     │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
    ┌────────┐    ┌──────────┐
    │  SQS   │    │CloudWatch│
    │ Queues │    │   Logs   │
    └───┬────┘    └──────────┘
        │
        ▼
   ┌─────────┐
   │ Lambda  │
   │Consumers│
   └─────────┘
```

## License

MIT
