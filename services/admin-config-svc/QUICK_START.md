# Admin Configuration Service - Quick Start Guide

## Overview

The Admin Configuration Service provides centralized management of system-wide settings with automatic hot-reload, versioning, and audit logging.

## Quick Access

- **Admin UI**: `/admin/config`
- **API Base**: `/config`
- **Documentation**: [README.md](./README.md)

## Common Tasks

### 1. Update Matching Weights

**Via UI**:
1. Navigate to `/admin/config/matching`
2. Adjust sliders for each weight
3. Ensure weights sum to 1.0
4. Click "Save Changes"

**Via API**:
```bash
curl -X PUT https://api.roadcall.com/config/matching \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "weights": {
        "distance": 0.35,
        "capability": 0.25,
        "availability": 0.20,
        "acceptanceRate": 0.10,
        "rating": 0.10
      },
      "defaultRadius": 50,
      "maxRadius": 200,
      "radiusExpansionFactor": 0.25,
      "maxExpansionAttempts": 3,
      "offerTimeoutSeconds": 120,
      "maxOffersPerIncident": 3
    },
    "reason": "Increased distance weight based on performance analysis"
  }'
```

### 2. Create a Geofence

**Via UI**:
1. Navigate to `/admin/config/geofences`
2. Click "Create Geofence"
3. Fill in name and region
4. Click "Start Drawing"
5. Click on map to add points
6. Click "Close Polygon" when done
7. Click "Save Geofence"

**Via API**:
```bash
curl -X POST https://api.roadcall.com/config/geofences \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### 3. Update SLA Tiers

```bash
curl -X PUT https://api.roadcall.com/config/sla-tiers \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "tiers": [
        {
          "name": "Standard",
          "responseTimeMinutes": 15,
          "arrivalTimeMinutes": 60,
          "pricingMultiplier": 1.0,
          "priority": 1
        },
        {
          "name": "Priority",
          "responseTimeMinutes": 10,
          "arrivalTimeMinutes": 45,
          "pricingMultiplier": 1.25,
          "priority": 2
        },
        {
          "name": "Emergency",
          "responseTimeMinutes": 5,
          "arrivalTimeMinutes": 30,
          "pricingMultiplier": 1.5,
          "priority": 3
        }
      ],
      "defaultTier": "Standard"
    },
    "reason": "Updated response times based on SLA review"
  }'
```

### 4. Rollback Configuration

```bash
curl -X POST https://api.roadcall.com/config/rollback \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "configKey": "matching",
    "targetVersion": 4,
    "reason": "Reverting problematic weight changes"
  }'
```

### 5. View Configuration History

```bash
curl -X GET "https://api.roadcall.com/config?configKey=matching&includeHistory=true" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Using Configuration in Your Service

### 1. Install Dependencies

```bash
pnpm add @roadcall/admin-config-svc
```

### 2. Use ConfigCache

```typescript
import { ConfigCache } from '@roadcall/admin-config-svc';

// Get matching configuration (cached)
const config = await ConfigCache.getMatchingConfig();

// Use in your logic
const score = 
  config.weights.distance * distanceScore +
  config.weights.capability * capabilityScore +
  config.weights.availability * availabilityScore +
  config.weights.acceptanceRate * acceptanceScore +
  config.weights.rating * ratingScore;
```

### 3. Subscribe to Configuration Changes

Add to your CDK stack:

```typescript
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

// Create handler for config changes
const configChangeHandler = new NodejsFunction(this, 'ConfigChangeHandler', {
  entry: path.join(__dirname, '../handlers/config-change-handler.ts'),
  handler: 'handler',
  environment: {
    CONFIG_TABLE_NAME: configTable.tableName,
  },
});

// Grant read access
configTable.grantReadData(configChangeHandler);

// Create EventBridge rule
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

configChangeRule.addTarget(new LambdaFunction(configChangeHandler));
```

### 4. Handle Configuration Changes

```typescript
import { EventBridgeEvent } from 'aws-lambda';
import { ConfigCache } from '@roadcall/admin-config-svc';

export async function handler(
  event: EventBridgeEvent<'ConfigurationChanged', any>
): Promise<void> {
  const { configKey, version } = event.detail;
  
  // Invalidate cache
  ConfigCache.invalidate(configKey);
  
  // Optionally pre-warm cache
  if (configKey === 'matching') {
    const newConfig = await ConfigCache.getMatchingConfig();
    console.log('New config loaded:', { version, weights: newConfig.weights });
  }
}
```

## Validation Rules

### Matching Configuration
- ✅ Weights must sum to 1.0 (±0.001 tolerance)
- ✅ All weights between 0 and 1
- ✅ Default radius > 0
- ✅ Max radius > default radius
- ✅ Expansion factor between 0 and 1
- ✅ Max attempts between 1 and 10
- ✅ Timeout between 30 and 600 seconds
- ✅ Max offers between 1 and 10

### SLA Configuration
- ✅ At least one tier required
- ✅ Unique tier names
- ✅ Unique priorities
- ✅ Response time < arrival time
- ✅ Response time: 1-120 minutes
- ✅ Arrival time: 1-240 minutes
- ✅ Pricing multiplier: 0-5
- ✅ Priority: 1-10
- ✅ Default tier must exist

### Geofence Configuration
- ✅ Minimum 3 points (4 with closing)
- ✅ Polygon must be closed
- ✅ Longitude: -180 to 180
- ✅ Latitude: -90 to 90
- ✅ Name and region required

## Monitoring

### Key Metrics
- Configuration update frequency
- Validation error rate
- Hot-reload propagation time
- API latency (P95, P99)
- Cache hit/miss ratio

### CloudWatch Logs
```bash
# View config service logs
aws logs tail /aws/lambda/roadcall-update-config-dev --follow

# View stream handler logs
aws logs tail /aws/lambda/roadcall-config-change-notifier-dev --follow
```

### Cache Status
```typescript
import { ConfigCache } from '@roadcall/admin-config-svc';

const status = ConfigCache.getCacheStatus();
console.log('Cache status:', status);
// Output: [{ key: 'matching', version: 5, age: 30000 }]
```

## Troubleshooting

### Configuration not updating
1. Check EventBridge event delivery
2. Verify service subscription
3. Check cache TTL (60 seconds)
4. Review CloudWatch logs

### Validation errors
1. Check API response for specific error
2. Review validation rules above
3. Ensure all required fields provided
4. Verify data types

### Rollback fails
1. Ensure target version exists
2. Check admin permissions
3. Verify table access
4. Review CloudWatch logs

## Best Practices

1. **Always provide a reason** when updating configurations
2. **Test in dev first** before applying to production
3. **Monitor KPIs** after configuration changes
4. **Use rollback** if issues arise
5. **Document changes** in reason field
6. **Make gradual changes** rather than large adjustments
7. **Validate weights** sum to 1.0 before saving

## Support

- **Documentation**: [README.md](./README.md)
- **Examples**: [examples/match-service-integration.ts](./examples/match-service-integration.ts)
- **CloudWatch Logs**: `/aws/lambda/roadcall-*-config-*`
- **Audit Logs**: Query via API with `includeHistory=true`

## Quick Reference

| Task | Endpoint | Method |
|------|----------|--------|
| Get matching config | `/config/matching` | GET |
| Update matching config | `/config/matching` | PUT |
| Get SLA config | `/config/sla-tiers` | GET |
| Update SLA config | `/config/sla-tiers` | PUT |
| Create geofence | `/config/geofences` | POST |
| Rollback config | `/config/rollback` | POST |
| Get with history | `/config?configKey=X&includeHistory=true` | GET |

All endpoints require:
- Valid JWT token
- Admin role
- Content-Type: application/json

## Next Steps

1. Explore the [full documentation](./README.md)
2. Review [integration examples](./examples/match-service-integration.ts)
3. Set up monitoring dashboards
4. Configure EventBridge subscriptions
5. Test configuration changes in dev environment
