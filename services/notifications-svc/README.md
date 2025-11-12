# Notifications Service

Multi-channel notification delivery service for the AI Roadcall Assistant platform. Supports push notifications, SMS, and email with user preferences, rate limiting, and delivery tracking.

## Features

- **Multi-Channel Delivery**: Push notifications (Pinpoint), SMS (Pinpoint), Email (SES)
- **Event-Driven**: Subscribes to EventBridge events for automatic notifications
- **User Preferences**: Customizable notification settings per user
- **Rate Limiting**: 10 SMS per user per hour to prevent abuse
- **Quiet Hours**: Respect user quiet hours for non-urgent notifications
- **Priority Handling**: Urgent notifications bypass quiet hours
- **Delivery Tracking**: Log all notifications with delivery status
- **Template System**: Reusable templates with variable substitution
- **Queue Buffering**: SQS queue for reliable delivery with retry

## Architecture

```
EventBridge Events → Lambda (event-handler) → Notification Service
                                                      ↓
API Gateway → Lambda (send-notification) → Notification Service
                                                      ↓
SQS Queue → Lambda (sqs-processor) → Notification Service
                                                      ↓
                                            ┌─────────┴─────────┐
                                            ↓         ↓         ↓
                                        Pinpoint    SES    DynamoDB
                                        (Push/SMS) (Email) (Logs)
```

## Notification Types

- `offer_received` - Vendor receives new job offer
- `offer_accepted` - Driver notified vendor accepted
- `vendor_en_route` - Vendor started navigation
- `vendor_arrived` - Vendor arrived at location
- `work_started` - Work in progress
- `work_completed` - Work done, request rating
- `payment_approved` - Payment processed
- `incident_cancelled` - Incident cancelled
- `otp_code` - Authentication OTP
- `system_alert` - System notifications

## API Endpoints

### Send Notification
```
POST /notifications
```

Request:
```json
{
  "type": "offer_received",
  "recipientId": "vendor-123",
  "recipientType": "vendor",
  "channels": ["push", "sms"],
  "priority": "urgent",
  "data": {
    "incidentId": "inc-456",
    "offerId": "offer-789",
    "incidentType": "tire",
    "distance": "15",
    "payout": "150"
  }
}
```

Response:
```json
{
  "data": {
    "notificationId": "notif-abc",
    "deliveryStatus": {
      "push": {
        "status": "sent",
        "timestamp": "2024-01-15T10:30:00Z",
        "messageId": "msg-123"
      },
      "sms": {
        "status": "sent",
        "timestamp": "2024-01-15T10:30:01Z",
        "messageId": "msg-456"
      }
    }
  }
}
```

### Get User Preferences
```
GET /notifications/preferences/{userId}
```

Response:
```json
{
  "data": {
    "userId": "user-123",
    "channels": {
      "push": { "enabled": true },
      "sms": { "enabled": true },
      "email": { "enabled": false }
    },
    "mutedTypes": ["system_alert"],
    "quietHours": {
      "start": "22:00",
      "end": "08:00",
      "timezone": "America/New_York"
    },
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Update User Preferences
```
PATCH /notifications/preferences/{userId}
```

Request:
```json
{
  "channels": {
    "email": { "enabled": true }
  },
  "mutedTypes": ["system_alert", "work_started"]
}
```

### Get Notification History
```
GET /notifications/history/{userId}?limit=50&nextToken=abc123
```

Response:
```json
{
  "data": {
    "items": [
      {
        "notificationId": "notif-123",
        "type": "offer_received",
        "channels": ["push", "sms"],
        "deliveryStatus": {
          "push": { "status": "sent", "timestamp": "..." },
          "sms": { "status": "sent", "timestamp": "..." }
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "nextToken": "xyz789"
  }
}
```

## EventBridge Integration

The service automatically subscribes to these events:

- `OfferCreated` → `offer_received` notification
- `OfferAccepted` → `offer_accepted` notification
- `TrackingStarted` → `vendor_en_route` notification
- `VendorArrived` → `vendor_arrived` notification
- `WorkStarted` → `work_started` notification
- `WorkCompleted` → `work_completed` notification
- `PaymentApproved` → `payment_approved` notification
- `IncidentCancelled` → `incident_cancelled` notification

## Rate Limiting

SMS notifications are rate-limited to 10 per user per hour. Rate limits are tracked in DynamoDB with TTL for automatic cleanup.

When rate limit is exceeded:
- SMS channel is skipped
- Other channels (push, email) still deliver
- Delivery status indicates rate limiting

## Quiet Hours

Users can configure quiet hours (e.g., 10 PM - 8 AM). During quiet hours:
- Non-urgent notifications only send via push (silent)
- SMS and email are suppressed
- Urgent notifications bypass quiet hours

Urgent notification types:
- `offer_received`
- `vendor_arrived`
- `otp_code`
- `system_alert`

## Template System

Templates support variable substitution using `{{variable}}` syntax:

```typescript
const template = 'New {{incidentType}} job {{distance}} miles away';
const data = { incidentType: 'tire', distance: '15' };
const rendered = renderTemplate(template, data);
// Result: "New tire job 15 miles away"
```

Templates are defined in `src/templates.ts` and include:
- Push notification (title, body, data)
- SMS message
- Email (subject, HTML body, text body)

## DynamoDB Tables

### NotificationLog
- PK: `notificationId`
- GSI: `recipientId-createdAt-index`
- TTL: `expiresAt` (90 days)

### NotificationPreferences
- PK: `userId`

### NotificationRateLimits
- PK: `rateLimitKey` (userId#channel)
- TTL: `expiresAt` (1 hour)

## Environment Variables

```bash
NOTIFICATION_LOG_TABLE=NotificationLog
PREFERENCES_TABLE=NotificationPreferences
RATE_LIMIT_TABLE=NotificationRateLimits
PINPOINT_APP_ID=your-pinpoint-app-id
SES_FROM_EMAIL=noreply@roadcall.example.com
```

## Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test --coverage

# Type check
pnpm typecheck
```

## Deployment

The service is deployed as part of the CDK infrastructure:

```typescript
// In infrastructure/lib/notifications-stack.ts
const notificationsService = new NotificationsService(this, 'NotificationsService', {
  eventBus: props.eventBus,
  pinpointAppId: props.pinpointAppId,
  sesFromEmail: props.sesFromEmail,
});
```

## Error Handling

- Failed deliveries are logged with error details
- SQS queue provides automatic retry (3 attempts)
- Dead-letter queue captures permanently failed notifications
- CloudWatch alarms monitor error rates

## Monitoring

Key metrics:
- Notification delivery rate by channel
- Rate limit violations
- Template rendering errors
- API latency
- SQS queue depth

CloudWatch dashboards show:
- Notifications sent per minute
- Delivery success rate by channel
- Top notification types
- User preference changes

## Future Enhancements

- [ ] In-app notifications
- [ ] Notification batching (digest emails)
- [ ] A/B testing for templates
- [ ] Rich push notifications (images, actions)
- [ ] Webhook delivery channel
- [ ] Multi-language templates
- [ ] Notification scheduling
- [ ] User notification analytics
