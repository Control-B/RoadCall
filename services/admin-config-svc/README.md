# Admin Configuration Service

The Admin Configuration Service provides a centralized system for managing platform-wide configuration settings with versioning, audit logging, and hot-reload capabilities.

## Features

- **Configuration Management**: CRUD operations for system configurations
- **Versioning**: Full version history with rollback capability
- **Audit Logging**: Complete audit trail of all configuration changes
- **Hot-Reload**: Configuration changes propagate to services within 60 seconds via EventBridge
- **Validation**: Comprehensive validation for all configuration types
- **Admin UI**: Web-based interface for managing configurations

## Configuration Types

### 1. Matching Configuration
Controls the vendor matching algorithm behavior:

```typescript
{
  weights: {
    distance: 0.30,          // 30% weight on proximity
    capability: 0.25,        // 25% weight on service capability match
    availability: 0.20,      // 20% weight on current availability
    acceptanceRate: 0.15,    // 15% weight on historical acceptance rate
    rating: 0.10             // 10% weight on vendor rating
  },
  defaultRadius: 50,         // Initial search radius in miles
  maxRadius: 200,            // Maximum search radius
  radiusExpansionFactor: 0.25, // 25% expansion per attempt
  maxExpansionAttempts: 3,   // Max number of radius expansions
  offerTimeoutSeconds: 120,  // Vendor response timeout
  maxOffersPerIncident: 3    // Max concurrent offers
}
```

**Validation Rules**:
- All weights must sum to 1.0
- Weights must be between 0 and 1
- Default radius must be less than max radius
- Expansion factor must be between 0 and 1
- Timeout must be between 30 and 600 seconds

### 2. SLA Tiers Configuration
Defines service level agreements and response time targets:

```typescript
{
  tiers: [
    {
      name: "Standard",
      responseTimeMinutes: 15,
      arrivalTimeMinutes: 60,
      pricingMultiplier: 1.0,
      priority: 1
    },
    {
      name: "Priority",
      responseTimeMinutes: 10,
      arrivalTimeMinutes: 45,
      pricingMultiplier: 1.25,
      priority: 2
    },
    {
      name: "Emergency",
      responseTimeMinutes: 5,
      arrivalTimeMinutes: 30,
      pricingMultiplier: 1.5,
      priority: 3
    }
  ],
  defaultTier: "Standard"
}
```

**Validation Rules**:
- At least one tier required
- Tier names must be unique
- Priorities must be unique
- Response time must be less than arrival time
- Pricing multiplier must be between 0 and 5
- Default tier must exist in tiers array

### 3. Geofence Configuration
Defines service coverage areas as polygons:

```typescript
{
  geofenceId: "uuid",
  name: "Downtown Service Area",
  description: "Primary coverage zone",
  polygon: {
    coordinates: [
      [-74.0060, 40.7128],  // [lon, lat] pairs
      [-74.0050, 40.7138],
      [-74.0040, 40.7128],
      [-74.0060, 40.7128]   // Closed polygon
    ]
  },
  region: "Northeast",
  active: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

**Validation Rules**:
- Minimum 3 coordinate pairs (4 including closing point)
- Polygon must be closed (first and last points match)
- Longitude must be between -180 and 180
- Latitude must be between -90 and 90
- Name and region are required

### 4. Pricing Configuration
Sets base rates and pricing structure:

```typescript
{
  baseRates: {
    tire: 150,
    engine: 200,
    tow: 250
  },
  perMileRate: 3.5,
  currency: "USD"
}
```

## API Endpoints

### Get Matching Configuration
```http
GET /config/matching
Authorization: Bearer <jwt-token>
```

**Response**:
```json
{
  "config": { ... },
  "version": 5,
  "updatedBy": "admin-user-id",
  "updatedAt": "2024-01-01T00:00:00Z",
  "isDefault": false
}
```

### Update Matching Configuration
```http
PUT /config/matching
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "config": { ... },
  "reason": "Adjusted weights based on performance analysis"
}
```

**Response**:
```json
{
  "message": "Configuration updated successfully",
  "config": { ... },
  "version": 6,
  "updatedBy": "admin-user-id",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Get SLA Tiers Configuration
```http
GET /config/sla-tiers
Authorization: Bearer <jwt-token>
```

### Update SLA Tiers Configuration
```http
PUT /config/sla-tiers
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "config": { ... },
  "reason": "Added new Emergency tier"
}
```

### Create Geofence
```http
POST /config/geofences
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Downtown Service Area",
  "description": "Primary coverage zone",
  "region": "Northeast",
  "polygon": {
    "coordinates": [...]
  },
  "active": true
}
```

### Rollback Configuration
```http
POST /config/rollback
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "configKey": "matching",
  "targetVersion": 4,
  "reason": "Reverting problematic changes"
}
```

**Response**:
```json
{
  "message": "Configuration rolled back to version 4",
  "config": { ... },
  "version": 7,
  "rolledBackFrom": 4,
  "updatedBy": "admin-user-id",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Hot-Reload Mechanism

Configuration changes are propagated to all services within 60 seconds using the following flow:

1. **Configuration Update**: Admin updates configuration via API
2. **DynamoDB Stream**: Change triggers DynamoDB Stream event
3. **Stream Handler**: Lambda function processes the stream event
4. **EventBridge Event**: Publishes `ConfigurationChanged` event to EventBridge
5. **Service Subscribers**: Services subscribed to EventBridge receive notification
6. **Cache Refresh**: Services refresh their cached configuration

### EventBridge Event Schema

```json
{
  "Source": "roadcall.admin-config",
  "DetailType": "ConfigurationChanged",
  "Detail": {
    "configKey": "matching",
    "version": 6,
    "updatedBy": "admin-user-id",
    "updatedAt": "2024-01-01T00:00:00Z",
    "changeType": "updated"
  }
}
```

### Subscribing to Configuration Changes

Services can subscribe to configuration changes by creating an EventBridge rule:

```typescript
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const configChangeRule = new Rule(this, 'ConfigChangeRule', {
  eventBus: eventBus,
  eventPattern: {
    source: ['roadcall.admin-config'],
    detailType: ['ConfigurationChanged'],
    detail: {
      configKey: ['matching'], // Subscribe to specific config keys
    },
  },
});

configChangeRule.addTarget(new LambdaFunction(refreshConfigHandler));
```

## Audit Trail

All configuration changes are logged with:
- User ID and username
- Action type (CREATE, UPDATE, DELETE, ROLLBACK)
- Previous and new values
- Version number
- Timestamp
- Optional reason

Query audit history:
```http
GET /config?configKey=matching&includeHistory=true
Authorization: Bearer <jwt-token>
```

## Version Management

### Listing Versions
Each configuration maintains a complete version history. Use the ConfigManager utility:

```typescript
import { ConfigManager } from './utils/config-manager';

const versions = await ConfigManager.listVersions('matching');
// Returns array of all versions, most recent first
```

### Rolling Back
Rollback creates a new version with the content of a previous version:

```typescript
const rolledBackConfig = await ConfigManager.rollbackConfig(
  'matching',
  4, // target version
  userId,
  userName,
  'Reverting problematic changes'
);
```

## Admin Web Interface

The admin web interface provides:

1. **Configuration Dashboard**: Overview of all configuration types
2. **Matching Algorithm Editor**: Visual weight adjustment with sliders
3. **SLA Tiers Manager**: Create and edit service tiers
4. **Geofence Map Editor**: Interactive map for drawing coverage areas
5. **Version History**: View and rollback to previous versions
6. **Audit Log**: Complete change history

Access the admin interface at: `/admin/config`

## Security

- **Authentication**: All endpoints require valid JWT token from Cognito
- **Authorization**: Only users with `admin` role can modify configurations
- **Encryption**: All data encrypted at rest using KMS
- **Audit Logging**: Complete audit trail of all changes
- **Validation**: Comprehensive input validation prevents invalid configurations

## Database Schema

### Config Table
```
PK: configKey (string)
SK: version (number)
Attributes:
  - value (map)
  - isLatest (string) - 'true' or 'false'
  - updatedBy (string)
  - updatedAt (string)
  - description (string)

GSI: latest-version-index
  PK: configKey
  SK: isLatest
```

### Config Audit Table
```
PK: auditId (string)
SK: timestamp (string)
Attributes:
  - configKey (string)
  - userId (string)
  - userName (string)
  - action (string)
  - previousValue (map)
  - newValue (map)
  - version (number)
  - reason (string)

GSI: config-key-index
  PK: configKey
  SK: timestamp

GSI: user-index
  PK: userId
  SK: timestamp
```

### Config Versions Table
```
PK: configKey (string)
SK: version (number)
Attributes:
  - value (map)
  - createdBy (string)
  - createdAt (string)
  - description (string)
```

## Development

### Running Locally
```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check
pnpm typecheck
```

### Testing
```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration
```

## Deployment

The service is deployed as part of the infrastructure stack:

```bash
cd infrastructure
pnpm cdk deploy AdminConfigStack --context stage=dev
```

## Monitoring

Key metrics to monitor:
- Configuration update frequency
- Validation error rate
- Hot-reload propagation time
- API latency
- DynamoDB Stream processing lag

CloudWatch alarms are configured for:
- High error rates
- Stream processing failures
- API Gateway 5xx errors
- Lambda function errors

## Best Practices

1. **Always provide a reason**: Include a reason when updating configurations for audit purposes
2. **Test in dev first**: Test configuration changes in development before applying to production
3. **Monitor impact**: Watch KPIs after configuration changes to ensure desired effect
4. **Use rollback**: If issues arise, rollback to a known good version immediately
5. **Document changes**: Keep notes on why specific configurations were chosen
6. **Gradual changes**: Make incremental changes rather than large adjustments
7. **Validate weights**: Ensure matching weights sum to 1.0 before saving

## Troubleshooting

### Configuration not updating in services
- Check EventBridge event delivery
- Verify service is subscribed to ConfigurationChanged events
- Check service cache TTL settings
- Review CloudWatch logs for stream handler

### Validation errors
- Review validation rules in `validators.ts`
- Check API response for specific error message
- Ensure all required fields are provided
- Verify data types match expected schema

### Rollback fails
- Ensure target version exists
- Check user has admin permissions
- Verify DynamoDB table access
- Review CloudWatch logs for detailed error

## Support

For issues or questions:
- Check CloudWatch logs: `/aws/lambda/roadcall-*-config-*`
- Review audit logs for configuration history
- Contact DevOps team for infrastructure issues
