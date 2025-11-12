# Tracking Service

Real-time location tracking service for the AI Roadcall Assistant platform, built with AWS AppSync GraphQL.

## Overview

The tracking service provides real-time location tracking capabilities for vendors responding to roadside incidents. It uses AppSync GraphQL for real-time subscriptions, allowing drivers and dispatchers to see vendor location updates, route information, and estimated time of arrival (ETA).

## Features

- **Real-time Location Updates**: Track vendor location with updates every 10 seconds
- **ETA Calculation**: Automatic ETA calculation using AWS Location Service with traffic data
- **Arrival Detection**: Automatic detection when vendor arrives within 100 meters of incident
- **GraphQL Subscriptions**: Real-time updates pushed to subscribed clients
- **Vendor Path Tracking**: Maintains last 50 location points for route visualization
- **Caching**: 5-second TTL caching for query results to reduce load

## Architecture

```
┌─────────────┐
│   Mobile    │
│   Clients   │
└──────┬──────┘
       │
       │ GraphQL (WebSocket)
       │
┌──────▼──────────────────────┐
│   AWS AppSync GraphQL API   │
│   - Subscriptions           │
│   - Mutations               │
│   - Queries                 │
└──────┬──────────────────────┘
       │
       │ Lambda Resolvers
       │
┌──────▼──────────────────────┐
│   Tracking Service          │
│   - Start Tracking          │
│   - Update Location         │
│   - Calculate ETA           │
│   - Stop Tracking           │
└──────┬──────────────────────┘
       │
       ├─────────────┬─────────────┐
       │             │             │
┌──────▼──────┐ ┌───▼────────┐ ┌──▼──────────┐
│  DynamoDB   │ │   AWS      │ │  Incidents  │
│  Tracking   │ │  Location  │ │  Table      │
│  Sessions   │ │  Service   │ │             │
└─────────────┘ └────────────┘ └─────────────┘
```

## GraphQL Schema

### Types

```graphql
type TrackingSession {
  sessionId: ID!
  incidentId: ID!
  driverId: ID!
  vendorId: ID!
  status: TrackingStatus!
  driverLocation: Location!
  vendorLocation: Location!
  vendorPath: [Location!]!
  route: [RouteSegment!]!
  eta: ETA!
  geofenceId: String!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

enum TrackingStatus {
  ACTIVE
  ARRIVED
  COMPLETED
  CANCELLED
}
```

### Mutations

```graphql
# Start tracking session for an incident
startTracking(incidentId: ID!): TrackingSession!

# Update vendor's current location
updateVendorLocation(sessionId: ID!, location: LocationInput!): TrackingSession!

# Stop tracking session
stopTracking(sessionId: ID!): TrackingSession!
```

### Queries

```graphql
# Get tracking session by ID
getTrackingSession(sessionId: ID!): TrackingSession

# Get active tracking session for an incident
getActiveSessionByIncident(incidentId: ID!): TrackingSession
```

### Subscriptions

```graphql
# Subscribe to updates for a specific session
onTrackingUpdate(sessionId: ID!): TrackingSession

# Subscribe to all tracking updates for an incident
onIncidentTracking(incidentId: ID!): TrackingSession
```

## Usage Examples

### Start Tracking

```graphql
mutation StartTracking {
  startTracking(incidentId: "incident-123") {
    sessionId
    status
    eta {
      minutes
      distanceMiles
      arrivalTime
    }
  }
}
```

### Update Vendor Location

```graphql
mutation UpdateLocation {
  updateVendorLocation(
    sessionId: "session-456"
    location: {
      lat: 40.7128
      lon: -74.0060
      timestamp: "2024-01-15T10:30:00Z"
      accuracy: 10.5
      speed: 45.0
      heading: 180.0
    }
  ) {
    sessionId
    status
    vendorLocation {
      lat
      lon
      timestamp
    }
    eta {
      minutes
      distanceMiles
      arrivalTime
      confidence
    }
  }
}
```

### Subscribe to Tracking Updates

```graphql
subscription TrackVendor {
  onIncidentTracking(incidentId: "incident-123") {
    sessionId
    status
    vendorLocation {
      lat
      lon
      timestamp
    }
    eta {
      minutes
      distanceMiles
      arrivalTime
    }
  }
}
```

### Query Active Session

```graphql
query GetActiveSession {
  getActiveSessionByIncident(incidentId: "incident-123") {
    sessionId
    status
    vendorLocation {
      lat
      lon
    }
    eta {
      minutes
      arrivalTime
    }
  }
}
```

## ETA Calculation

The service calculates ETA using AWS Location Service with the following features:

1. **Primary Method**: AWS Location Service Routes API
   - Real-time traffic data
   - Accurate road routing
   - Travel time estimation
   - Confidence score: 0.85

2. **Fallback Method**: Haversine distance calculation
   - Straight-line distance
   - Assumed average speed (45 mph)
   - Used when Location Service unavailable
   - Confidence score: 0.5

3. **Recalculation Triggers**:
   - Vendor moves more than 0.1 miles
   - Every 30 seconds (configurable)
   - On significant route deviation

## Arrival Detection

The service automatically detects when a vendor arrives at the incident location:

- **Geofence Radius**: 100 meters around incident location
- **Status Update**: Automatically changes status to `ARRIVED`
- **ETA Update**: Sets ETA to 0 minutes with 100% confidence
- **Notification**: Triggers arrival event for notifications service

## Performance Characteristics

- **Location Update Frequency**: Every 10 seconds (recommended)
- **ETA Recalculation**: On significant movement (>0.1 miles)
- **Query Caching**: 5-second TTL for read operations
- **Vendor Path Buffer**: Last 50 location points
- **Lambda Timeout**: 30 seconds
- **Lambda Memory**: 1024 MB

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TABLE_NAME` | DynamoDB tracking sessions table name | Yes |
| `INCIDENTS_TABLE_NAME` | DynamoDB incidents table name | Yes |
| `LOCATION_CALCULATOR_NAME` | AWS Location Service calculator name | Yes |
| `POWERTOOLS_SERVICE_NAME` | Service name for logging | Yes |
| `POWERTOOLS_LOG_LEVEL` | Log level (DEBUG, INFO, WARN, ERROR) | Yes |

## Data Model

### TrackingSession (DynamoDB)

```typescript
{
  sessionId: string;           // PK
  incidentId: string;          // GSI
  driverId: string;
  vendorId: string;            // GSI (with status)
  status: TrackingStatus;
  driverLocation: Location;
  vendorLocation: Location;
  vendorPath: Location[];      // Max 50 points
  route: RouteSegment[];
  eta: ETACalculation;
  geofenceId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Indexes

- **Primary Key**: `sessionId`
- **GSI1**: `incidentId` - Query sessions by incident
- **GSI2**: `vendorId` + `status` - Query active sessions by vendor

## Error Handling

The service handles the following error scenarios:

1. **Session Not Found**: Returns null for queries, throws error for mutations
2. **Invalid Location Data**: Validates lat/lon ranges before processing
3. **Location Service Unavailable**: Falls back to Haversine calculation
4. **Inactive Session**: Prevents location updates on completed/cancelled sessions
5. **Missing Incident**: Validates incident exists before starting tracking

## Monitoring

Key metrics to monitor:

- **Location Update Latency**: Time to process location updates
- **ETA Calculation Duration**: Time to calculate ETA
- **Subscription Connection Count**: Number of active WebSocket connections
- **Error Rate**: Failed location updates or ETA calculations
- **Cache Hit Rate**: AppSync query cache effectiveness

## Testing

```bash
# Build the service
npm run build

# Type check
npm run typecheck

# Run tests (when implemented)
npm test
```

## Deployment

The tracking service is deployed as part of the CDK infrastructure:

```bash
# Deploy to dev environment
cd infrastructure
npm run cdk deploy RoadcallTrackingStack-dev -- --context stage=dev

# Deploy to production
npm run cdk deploy RoadcallTrackingStack-prod -- --context stage=prod
```

## Requirements Satisfied

This implementation satisfies the following requirements from the design document:

- **Requirement 6.1**: Real-time location tracking with GraphQL subscriptions
- **Requirement 6.2**: Location updates every 10 seconds
- **Requirement 23.1**: GraphQL subscription connections via AppSync
- **Requirement 23.2**: Updates pushed to clients within 2 seconds

## Future Enhancements

- [ ] Integration with AWS Location Service Geofencing for automatic arrival detection
- [ ] Route optimization suggestions
- [ ] Historical path replay
- [ ] Traffic condition alerts
- [ ] Multi-vendor tracking for comparison
- [ ] Predictive ETA using machine learning
