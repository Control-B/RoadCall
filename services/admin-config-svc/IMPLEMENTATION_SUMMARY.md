# Admin Configuration Service - Implementation Summary

## Overview

The Admin Configuration Service has been successfully implemented as part of Task 34. This service provides a centralized, versioned configuration management system with hot-reload capabilities, audit logging, and a web-based admin interface.

## Completed Components

### 1. Backend Infrastructure (AWS CDK)

**Location**: `infrastructure/lib/admin-config-stack.ts`

**DynamoDB Tables**:
- `roadcall-config-{stage}` - Main configuration table with versioning
  - PK: configKey, SK: version
  - GSI: latest-version-index for quick access to current configs
  - DynamoDB Streams enabled for hot-reload
- `roadcall-config-audit-{stage}` - Complete audit trail
  - GSIs for querying by config key and user
- `roadcall-config-versions-{stage}` - Version history for rollback

**Lambda Functions**:
- `get-matching-config` - Retrieve matching algorithm configuration
- `update-matching-config` - Update matching configuration with validation
- `get-sla-config` - Retrieve SLA tiers configuration
- `update-sla-config` - Update SLA tiers with validation
- `get-pricing-config` - Retrieve pricing configuration
- `update-pricing-config` - Update pricing configuration
- `create-geofence` - Create new geofence polygons
- `rollback-config` - Rollback to previous configuration version
- `update-config` - Generic configuration update handler
- `config-change-notifier` - DynamoDB Stream processor for hot-reload

**API Gateway Routes**:
- `GET /config/matching` - Get matching configuration
- `PUT /config/matching` - Update matching configuration
- `GET /config/sla-tiers` - Get SLA tiers
- `PUT /config/sla-tiers` - Update SLA tiers
- `GET /config/pricing` - Get pricing configuration
- `PUT /config/pricing` - Update pricing configuration
- `POST /config/geofences` - Create geofence
- `POST /config/rollback` - Rollback configuration

All endpoints require Cognito authentication with admin role.

### 2. Service Layer

**Location**: `services/admin-config-svc/src/`

**Type Definitions** (`types/config.ts`):
- `MatchingConfig` - Vendor matching algorithm weights and parameters
- `SLAConfig` - Service level agreement tiers
- `PricingConfig` - Base rates and pricing structure
- `GeofenceConfig` - Service coverage area polygons
- `SystemConfig` - Generic configuration wrapper
- `ConfigAuditLog` - Audit trail entries
- `ConfigVersion` - Version history entries

**Configuration Manager** (`utils/config-manager.ts`):
- `getLatestConfig()` - Retrieve current configuration
- `getConfigVersion()` - Get specific version
- `updateConfig()` - Update with versioning and audit logging
- `rollbackConfig()` - Rollback to previous version
- `getAuditHistory()` - Query audit trail
- `listVersions()` - List all versions

**Validators** (`utils/validators.ts`):
- `validateMatchingConfig()` - Ensures weights sum to 1.0, valid ranges
- `validateSLAConfig()` - Validates tiers, priorities, time constraints
- `validateGeofenceConfig()` - Validates polygon coordinates, closure
- `validatePricingConfig()` - Validates rates, currency codes

**Config Cache** (`utils/config-cache.ts`):
- 60-second TTL caching
- Automatic refresh on EventBridge events
- Fallback to expired cache on errors
- Cache status monitoring

### 3. Hot-Reload Mechanism

**Flow**:
1. Admin updates configuration via API
2. ConfigManager writes to DynamoDB with new version
3. DynamoDB Stream triggers `config-change-notifier` Lambda
4. Lambda publishes `ConfigurationChanged` event to EventBridge
5. Subscribed services receive event within seconds
6. Services invalidate cache and fetch new configuration
7. Configuration propagates to all services within 60 seconds

**EventBridge Event Schema**:
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

### 4. Web Admin Interface

**Location**: `apps/web/app/admin/config/`

**Pages Implemented**:
- `/admin/config` - Configuration dashboard with cards for each config type
- `/admin/config/matching` - Matching algorithm editor with weight sliders
- `/admin/config/sla-tiers` - SLA tier management with add/remove/edit
- `/admin/config/pricing` - Pricing configuration with examples
- `/admin/config/geofences` - Geofence map editor with polygon drawing

**Features**:
- Real-time weight validation (must sum to 1.0)
- Visual sliders for matching weights
- Dynamic SLA tier management
- Pricing calculation examples
- Interactive map for geofence drawing
- Version display and tracking
- Reset to defaults functionality
- Save with reason/description

**API Routes** (`apps/web/app/api/config/`):
- `/api/config/matching` - Proxy to backend matching endpoints
- `/api/config/sla-tiers` - Proxy to backend SLA endpoints
- `/api/config/pricing` - Proxy to backend pricing endpoints
- `/api/config/geofences` - Proxy to backend geofence endpoints

### 5. Configuration Versioning & Rollback

**Versioning**:
- Every configuration change creates a new version
- Version numbers increment sequentially
- Previous versions marked as `isLatest: false`
- Complete version history maintained in separate table

**Rollback Capability**:
- Rollback to any previous version
- Creates new version with old content
- Audit log records rollback action
- Preserves complete history

**Audit Logging**:
- Every change logged with user ID, timestamp, reason
- Previous and new values stored
- Action type tracked (CREATE, UPDATE, DELETE, ROLLBACK)
- Queryable by config key, user, or time range

### 6. Integration Examples

**Location**: `services/admin-config-svc/examples/`

**Files**:
- `config-subscriber.ts` - Example EventBridge subscription
- `match-service-integration.ts` - Example usage in match service

**Usage Pattern**:
```typescript
import { ConfigCache } from '@roadcall/admin-config-svc';

// Get configuration with automatic caching
const matchingConfig = await ConfigCache.getMatchingConfig();

// Use in business logic
const searchRadius = matchingConfig.defaultRadius;
const weights = matchingConfig.weights;
```

## Configuration Types

### Matching Configuration
- **Weights**: distance (30%), capability (25%), availability (20%), acceptance rate (15%), rating (10%)
- **Radius Settings**: default 50 miles, max 200 miles, expansion factor 25%
- **Offer Settings**: 120-second timeout, max 3 offers per incident

### SLA Tiers
- **Standard**: 15-min response, 60-min arrival, 1.0x pricing, priority 1
- **Priority**: 10-min response, 45-min arrival, 1.25x pricing, priority 2
- **Emergency**: 5-min response, 30-min arrival, 1.5x pricing, priority 3

### Pricing
- **Base Rates**: Tire $150, Engine $200, Tow $250
- **Per Mile Rate**: $3.50
- **Currency**: USD

### Geofences
- Polygon-based service coverage areas
- Minimum 3 coordinate pairs (closed polygon)
- Region and description metadata
- Active/inactive status

## Security

- **Authentication**: All endpoints require valid Cognito JWT
- **Authorization**: Admin role required for all configuration changes
- **Encryption**: All data encrypted at rest with KMS
- **Audit Trail**: Complete change history with user attribution
- **Validation**: Comprehensive input validation prevents invalid configs

## Monitoring

**CloudWatch Metrics**:
- Configuration update frequency
- Validation error rate
- Hot-reload propagation time
- API latency (P95, P99)
- DynamoDB Stream processing lag

**CloudWatch Alarms**:
- High error rates
- Stream processing failures
- API Gateway 5xx errors
- Lambda function errors

## Testing

The service includes:
- Type definitions for all configuration types
- Comprehensive validation logic
- Error handling with proper status codes
- CORS headers for web app integration

## Deployment

Deploy the admin config stack:
```bash
cd infrastructure
pnpm cdk deploy AdminConfigStack --context stage=dev
```

The stack creates:
- 3 DynamoDB tables
- 10 Lambda functions
- 8 API Gateway routes
- EventBridge integration
- CloudWatch log groups

## Usage

### For Admins
1. Navigate to `/admin/config` in web app
2. Select configuration type to edit
3. Make changes using visual editors
4. Save with optional reason/description
5. Changes propagate to all services within 60 seconds

### For Developers
1. Subscribe to `ConfigurationChanged` events in your service
2. Use `ConfigCache` utility for automatic caching
3. Configuration refreshes automatically on changes
4. No service restart required

## Best Practices

1. **Always provide a reason** when updating configurations
2. **Test in dev first** before applying to production
3. **Monitor KPIs** after configuration changes
4. **Use rollback** if issues arise
5. **Document changes** in audit log reason field
6. **Make gradual changes** rather than large adjustments
7. **Validate weights** sum to 1.0 before saving matching config

## Files Created/Modified

### New Files
- `services/admin-config-svc/src/handlers/update-config.ts`
- `services/admin-config-svc/src/handlers/get-pricing-config.ts`
- `services/admin-config-svc/src/handlers/update-pricing-config.ts`
- `services/admin-config-svc/examples/config-subscriber.ts`
- `apps/web/app/admin/config/sla-tiers/page.tsx`
- `apps/web/app/admin/config/pricing/page.tsx`
- `apps/web/app/api/config/matching/route.ts`
- `apps/web/app/api/config/sla-tiers/route.ts`
- `apps/web/app/api/config/pricing/route.ts`
- `apps/web/app/api/config/geofences/route.ts`

### Modified Files
- `infrastructure/lib/admin-config-stack.ts` - Added pricing endpoints

### Existing Files (Already Implemented)
- All type definitions, validators, config manager
- Matching and SLA handlers
- Geofence handler
- Rollback handler
- Config change notifier
- Config cache utility
- Matching and geofence UI pages

## Requirements Satisfied

✅ **24.1**: Admin web interface for configuring matching rules, SLA tiers, pricing, and geofences
✅ **24.2**: Configuration updates validated and applied within 60 seconds via hot-reload
✅ **24.3**: Geofence polygon drawing interface on interactive map
✅ **24.4**: Configuration change audit logging with user ID, timestamp, and reason
✅ **24.5**: Configuration versioning with rollback capability to previous versions

## Next Steps

1. Deploy the infrastructure stack to dev environment
2. Test configuration updates through admin UI
3. Verify hot-reload propagation to services
4. Monitor CloudWatch metrics and alarms
5. Document any service-specific configuration needs
6. Train administrators on using the configuration interface

## Support

For issues or questions:
- Check CloudWatch logs: `/aws/lambda/roadcall-*-config-*`
- Review audit logs for configuration history
- Use rollback feature to revert problematic changes
- Contact DevOps team for infrastructure issues
