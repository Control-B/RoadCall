# Match Service (match-svc)

The Match Service is responsible for matching incidents with qualified vendors using a sophisticated scoring algorithm. It handles the complete vendor matching lifecycle including offer creation, acceptance, decline, and radius expansion.

## Features

- **Intelligent Vendor Matching**: Uses a weighted scoring algorithm considering distance, capability, availability, acceptance rate, and rating
- **Automatic Radius Expansion**: Expands search radius up to 3 times if no vendors are found
- **Optimistic Locking**: Prevents multiple vendors from accepting the same incident
- **Event-Driven Architecture**: Triggered by IncidentCreated events and publishes OfferCreated, OfferAccepted, and OfferDeclined events
- **TTL-Based Offers**: Offers automatically expire after 2 minutes
- **Dead Letter Queue**: Failed matches are sent to DLQ for manual review

## Match Scoring Algorithm

The algorithm calculates a weighted score (0-1) for each vendor based on:

- **Distance (30%)**: Proximity to incident location
- **Capability (25%)**: Exact match for required service type
- **Availability (20%)**: Current vendor availability status
- **Acceptance Rate (15%)**: Historical acceptance rate
- **Rating (10%)**: Average customer rating

### Score Calculation

```typescript
score = 
  0.30 * distanceScore +
  0.25 * capabilityScore +
  0.20 * availabilityScore +
  0.15 * acceptanceRateScore +
  0.10 * ratingScore
```

## API Endpoints

### GET /offers/{offerId}
Get offer details by ID.

**Response:**
```json
{
  "data": {
    "offerId": "uuid",
    "incidentId": "uuid",
    "vendorId": "uuid",
    "status": "pending",
    "matchScore": 0.85,
    "scoreBreakdown": {
      "distance": 0.9,
      "capability": 1.0,
      "availability": 1.0,
      "acceptanceRate": 0.85,
      "rating": 0.8
    },
    "estimatedPayout": 15000,
    "expiresAt": 1699999999,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### POST /offers/{offerId}/accept
Accept an offer (vendor only).

**Request:**
```json
{
  "vendorId": "uuid"
}
```

**Response:**
```json
{
  "data": {
    "offer": { /* offer object */ },
    "incident": { /* updated incident with assignedVendorId */ }
  }
}
```

### POST /offers/{offerId}/decline
Decline an offer (vendor only).

**Request:**
```json
{
  "vendorId": "uuid",
  "reason": "Too far away"
}
```

**Response:**
```json
{
  "data": {
    "offerId": "uuid",
    "status": "declined",
    "declineReason": "Too far away"
  }
}
```

## Event Handlers

### IncidentCreated Event Handler
Triggered when a new incident is created. Executes the vendor matching process with automatic radius expansion.

**Event Detail:**
```json
{
  "incidentId": "uuid",
  "driverId": "uuid",
  "type": "tire",
  "location": {
    "lat": 40.7128,
    "lon": -74.0060
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## Matching Flow

1. **Incident Created**: EventBridge event triggers matching
2. **Query Vendors**: Find vendors within radius (default 50 miles)
3. **Calculate Scores**: Score each vendor using weighted algorithm
4. **Rank Vendors**: Sort by score and select top 3
5. **Create Offers**: Generate offers with 2-minute TTL
6. **Publish Events**: Send OfferCreated events to notification service
7. **Wait for Response**: Vendors have 2 minutes to accept/decline
8. **Radius Expansion**: If no vendors found, expand radius by 25% (max 3 attempts)
9. **Escalation**: If no vendors after 3 attempts, escalate to dispatcher

## Radius Expansion

- **Default Radius**: 50 miles
- **Expansion Factor**: 25% increase per attempt
- **Max Attempts**: 3
- **Max Radius**: 150 miles

Example progression:
- Attempt 1: 50 miles
- Attempt 2: 62.5 miles
- Attempt 3: 78.125 miles

## Optimistic Locking

When a vendor accepts an offer, the service uses DynamoDB conditional writes to ensure the incident doesn't already have an assigned vendor:

```typescript
ConditionExpression: 'attribute_not_exists(assignedVendorId)'
```

If the condition fails, the vendor receives a 409 Conflict error.

## Environment Variables

- `OFFERS_TABLE`: DynamoDB table for offers
- `INCIDENTS_TABLE`: DynamoDB table for incidents
- `VENDORS_TABLE`: DynamoDB table for vendors
- `EVENT_BUS_NAME`: EventBridge event bus name
- `AWS_REGION`: AWS region

## Testing

Run unit tests:
```bash
npm test
```

Run with coverage:
```bash
npm test -- --coverage
```

## Dependencies

- `@roadcall/types`: Shared TypeScript types
- `@roadcall/utils`: Utility functions (logging, errors, geospatial)
- `@roadcall/aws-clients`: AWS service wrappers (DynamoDB, EventBridge)
- `uuid`: UUID generation

## Error Handling

- **NotFoundError (404)**: Offer or incident not found
- **ValidationError (400)**: Invalid request parameters
- **ConflictError (409)**: Incident already assigned or offer not pending
- **InternalError (500)**: Unexpected errors

All errors are logged and sent to CloudWatch for monitoring.

## Monitoring

Key metrics to monitor:
- Matching success rate
- Average match time
- Radius expansion frequency
- Offer acceptance rate
- Offer expiration rate
- DLQ message count

## Future Enhancements

- Redis geospatial indexing for faster vendor queries
- Machine learning-based score optimization
- Dynamic weight adjustment based on time of day/demand
- Vendor preference learning
- Multi-region vendor matching
