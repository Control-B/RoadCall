# Admin Configuration Service - Quick Reference

## API Endpoints

### Matching Configuration
```bash
# Get current matching config
GET /config/matching

# Update matching config
PUT /config/matching
{
  "config": {
    "weights": {
      "distance": 0.30,
      "capability": 0.25,
      "availability": 0.20,
      "acceptanceRate": 0.15,
      "rating": 0.10
    },
    "defaultRadius": 50,
    "maxRadius": 200,
    "radiusExpansionFactor": 0.25,
    "maxExpansionAttempts": 3,
    "offerTimeoutSeconds": 120,
    "maxOffersPerIncident": 3
  },
  "reason": "Adjusted weights based on performance analysis"
}
```

### SLA Tiers Configuration
```bash
# Get SLA tiers
GET /config/sla-tiers

# Update SLA tiers
PUT /config/sla-tiers
{
  "config": {
    "tiers": [
      {
        "name": "Standard",
        "responseTimeMinutes": 15,
        "arrivalTimeMinutes": 60,
        "pricingMultiplier": 1.0,
        "priority": 1
      }
    ],
    "defaultTier": "Standard"
  },
  "reason": "Added new Emergency tier"
}
```

### Pricing Configuration
```bash
# Get pricing config
GET /config/pricing

# Update pricing config
PUT /config/pricing
{
  "config": {
    "baseRates": {
      "tire": 150,
      "engine": 200,
      "tow": 250
    },
    "perMileRate": 3.5,
    "currency": "USD"
  },
  "reason": "Updated base rates for Q4"
}
```

### Geofences
```bash
# Create geofence
POST /config/geofences
{
  "name": "Downtown Service Area",
  "description": "Primary coverage zone",
  "region": "Northeast",
  "polygon": {
    "coordinates": [
      [-74.0060, 40.7128],
      [-74.0050, 40.7138],
      [-74.0040, 40.7128],
      [-74.0060, 40.7128]
    ]
  },
  "active": true
}
```

### Rollback
```bash
# Rollback to previous version
POST /config/rollback
{
  "configKey": "matching",
  "targetVersion": 4,
  "reason": "Reverting problematic changes"
}
```

## Using ConfigCache in Your Service

```typescript
import { ConfigCache } from '@roadcall/admin-config-svc';

// Get matching configuration (cached, auto-refreshes)
const matchingConfig = await ConfigCache.getMatchingConfig();

// Get SLA configuration
const slaConfig = await ConfigCache.getSLAConfig();

// Invalidate cache manually (usually not needed)
ConfigCache.invalidate('matching');

// Check cache status
const status = ConfigCache.getCacheStatus();
console.log(status);
```

## Subscribing to Configuration Changes

### CDK Setup
```typescript
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const configChangeRule = new Rule(this, 'ConfigChangeRule', {
  eventBus: eventBus,
  eventPattern: {
    source: ['roadcall.admin-config'],
    detailType: ['ConfigurationChanged'],
    detail: {
      configKey: ['matching'], // Subscribe to specific configs
    },
  },
});

configChangeRule.addTarget(new LambdaFunction(refreshConfigHandler));
```

### Lambda Handler
```typescript
import { EventBridgeEvent } from 'aws-lambda';
import { ConfigCache } from '@roadcall/admin-config-svc';

export const handler = async (
  event: EventBridgeEvent<'ConfigurationChanged', any>
) => {
  const { configKey, version } = event.detail;
  
  // Invalidate cache
  ConfigCache.invalidate(configKey);
  
  console.log(`Config ${configKey} updated to version ${version}`);
};
```

## Validation Rules

### Matching Config
- Weights must sum to 1.0 (±0.001 tolerance)
- All weights between 0 and 1
- Default radius < max radius
- Expansion factor between 0 and 1
- Timeout between 30 and 600 seconds

### SLA Config
- At least one tier required
- Unique tier names and priorities
- Response time < arrival time
- Pricing multiplier between 0 and 5
- Default tier must exist in tiers array

### Pricing Config
- All base rates must be positive
- Per mile rate must be positive
- Currency must be 3-letter ISO 4217 code

### Geofence Config
- Minimum 3 coordinate pairs
- Polygon must be closed (first = last point)
- Longitude between -180 and 180
- Latitude between -90 and 90
- Name and region required

## Common Tasks

### Update Matching Weights
1. Navigate to `/admin/config/matching`
2. Adjust sliders (ensure sum = 100%)
3. Click "Save Changes"
4. Changes propagate within 60 seconds

### Add New SLA Tier
1. Navigate to `/admin/config/sla-tiers`
2. Click "Add Tier"
3. Fill in tier details
4. Click "Save Changes"

### Create Service Coverage Area
1. Navigate to `/admin/config/geofences`
2. Click "Create Geofence"
3. Enter name and region
4. Click "Start Drawing"
5. Click on map to add points
6. Click "Close Polygon" when done
7. Click "Save Geofence"

### Rollback Configuration
1. Use API endpoint with target version
2. Or implement rollback UI in admin panel
3. Specify reason for rollback
4. New version created with old content

## Monitoring

### CloudWatch Logs
```bash
# View config service logs
aws logs tail /aws/lambda/roadcall-get-config-dev --follow

# View change notifier logs
aws logs tail /aws/lambda/roadcall-config-change-notifier-dev --follow
```

### Check Cache Status
```typescript
const status = ConfigCache.getCacheStatus();
// Returns: [{ key: 'matching', version: 5, age: 30000 }]
```

### Query Audit History
```typescript
import { ConfigManager } from '@roadcall/admin-config-svc';

const history = await ConfigManager.getAuditHistory('matching', 50);
// Returns last 50 changes with user, timestamp, reason
```

## Troubleshooting

### Configuration Not Updating
1. Check EventBridge event delivery
2. Verify service subscribed to ConfigurationChanged
3. Check service cache TTL (60 seconds)
4. Review CloudWatch logs for errors

### Validation Errors
1. Check validation rules above
2. Review API response for specific error
3. Ensure all required fields provided
4. Verify data types match schema

### Rollback Fails
1. Ensure target version exists
2. Check user has admin permissions
3. Verify DynamoDB table access
4. Review CloudWatch logs

## Environment Variables

```bash
CONFIG_TABLE_NAME=roadcall-config-dev
CONFIG_AUDIT_TABLE_NAME=roadcall-config-audit-dev
CONFIG_VERSIONS_TABLE_NAME=roadcall-config-versions-dev
EVENT_BUS_NAME=roadcall-events-dev
STAGE=dev
```

## Default Configurations

### Matching
- Distance: 30%, Capability: 25%, Availability: 20%, Acceptance: 15%, Rating: 10%
- Default radius: 50 miles, Max: 200 miles
- Expansion: 25%, Max attempts: 3
- Timeout: 120 seconds, Max offers: 3

### SLA Tiers
- Standard: 15/60 min, 1.0x, priority 1
- Priority: 10/45 min, 1.25x, priority 2
- Emergency: 5/30 min, 1.5x, priority 3

### Pricing
- Tire: $150, Engine: $200, Tow: $250
- Per mile: $3.50
- Currency: USD
