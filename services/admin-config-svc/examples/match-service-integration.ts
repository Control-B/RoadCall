/**
 * Example: How to integrate configuration management in the match service
 * 
 * This file demonstrates:
 * 1. Using ConfigCache to access configuration
 * 2. Handling ConfigurationChanged events for hot-reload
 * 3. Applying configuration to matching algorithm
 */

import { EventBridgeEvent } from 'aws-lambda';
import { ConfigCache } from '../src/utils/config-cache';
import { MatchingConfig } from '../src/types/config';

// ============================================================================
// Example 1: Using configuration in the matching algorithm
// ============================================================================

interface Vendor {
  vendorId: string;
  location: { lat: number; lon: number };
  capabilities: string[];
  availability: 'available' | 'busy' | 'offline';
  metrics: {
    acceptanceRate: number;
    avgRating: number;
  };
}

interface Incident {
  incidentId: string;
  type: string;
  location: { lat: number; lon: number };
}

/**
 * Calculate match score using configuration weights
 */
async function calculateMatchScore(
  vendor: Vendor,
  incident: Incident,
  distanceMiles: number
): Promise<number> {
  // Get latest matching configuration (cached)
  const config = await ConfigCache.getMatchingConfig();

  // Distance score (inverse, normalized to 0-1)
  const distanceScore = Math.max(0, 1 - (distanceMiles / config.maxRadius));

  // Capability score (exact match = 1, no match = 0)
  const capabilityScore = vendor.capabilities.includes(incident.type) ? 1 : 0;

  // Availability score
  const availabilityScore = vendor.availability === 'available' ? 1 : 0;

  // Historical acceptance rate (already 0-1)
  const acceptanceScore = vendor.metrics.acceptanceRate;

  // Rating score (normalized to 0-1)
  const ratingScore = vendor.metrics.avgRating / 5;

  // Calculate weighted score using configuration weights
  const score =
    config.weights.distance * distanceScore +
    config.weights.capability * capabilityScore +
    config.weights.availability * availabilityScore +
    config.weights.acceptanceRate * acceptanceScore +
    config.weights.rating * ratingScore;

  return score;
}

/**
 * Find matching vendors using configuration parameters
 */
async function findMatchingVendors(
  incident: Incident,
  allVendors: Vendor[]
): Promise<Vendor[]> {
  const config = await ConfigCache.getMatchingConfig();

  let radius = config.defaultRadius;
  let attempt = 0;
  let matches: Array<{ vendor: Vendor; score: number }> = [];

  // Try expanding radius until we find matches or hit max attempts
  while (matches.length === 0 && attempt < config.maxExpansionAttempts) {
    // Filter vendors within radius
    const candidateVendors = allVendors.filter((vendor) => {
      const distance = calculateDistance(incident.location, vendor.location);
      return distance <= radius;
    });

    // Calculate scores for candidates
    const scoredVendors = await Promise.all(
      candidateVendors.map(async (vendor) => {
        const distance = calculateDistance(incident.location, vendor.location);
        const score = await calculateMatchScore(vendor, incident, distance);
        return { vendor, score };
      })
    );

    // Filter out vendors with zero score (no capability match)
    matches = scoredVendors.filter((sv) => sv.score > 0);

    // Expand radius if no matches found
    if (matches.length === 0) {
      radius = radius * (1 + config.radiusExpansionFactor);
      attempt++;
      console.log(`No matches found, expanding radius to ${radius} miles (attempt ${attempt})`);
    }
  }

  // Sort by score and return top N vendors
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, config.maxOffersPerIncident).map((m) => m.vendor);
}

// ============================================================================
// Example 2: Handling configuration change events for hot-reload
// ============================================================================

interface ConfigurationChangedEvent {
  configKey: string;
  version: number;
  updatedBy: string;
  updatedAt: string;
  changeType: 'created' | 'updated';
}

/**
 * Lambda handler for ConfigurationChanged events
 * This enables hot-reload of configuration within 60 seconds
 */
export async function handleConfigurationChanged(
  event: EventBridgeEvent<'ConfigurationChanged', ConfigurationChangedEvent>
): Promise<void> {
  console.log('Configuration change detected:', event.detail);

  const { configKey, version, changeType } = event.detail;

  // Invalidate cache for the changed configuration
  ConfigCache.invalidate(configKey as any);

  console.log(`Cache invalidated for ${configKey} (version ${version}, ${changeType})`);

  // Optionally, pre-warm the cache by fetching the new configuration
  if (configKey === 'matching') {
    const newConfig = await ConfigCache.getMatchingConfig();
    console.log('New matching configuration loaded:', {
      version,
      weights: newConfig.weights,
      defaultRadius: newConfig.defaultRadius,
    });
  }

  // Emit custom metric for monitoring
  // await cloudwatch.putMetricData({
  //   Namespace: 'RoadCall/Config',
  //   MetricData: [{
  //     MetricName: 'ConfigurationReloaded',
  //     Value: 1,
  //     Dimensions: [{ Name: 'ConfigKey', Value: configKey }],
  //   }],
  // });
}

// ============================================================================
// Example 3: CDK EventBridge Rule for subscribing to config changes
// ============================================================================

/**
 * Add this to your match-stack.ts to subscribe to configuration changes:
 * 
 * import { Rule } from 'aws-cdk-lib/aws-events';
 * import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
 * 
 * // Create handler for config changes
 * const configChangeHandler = new NodejsFunction(this, 'ConfigChangeHandler', {
 *   entry: path.join(__dirname, '../../services/match-svc/src/handlers/config-change-handler.ts'),
 *   handler: 'handleConfigurationChanged',
 *   environment: {
 *     CONFIG_TABLE_NAME: configTable.tableName,
 *   },
 * });
 * 
 * // Grant read access to config table
 * configTable.grantReadData(configChangeHandler);
 * 
 * // Create EventBridge rule to trigger on config changes
 * const configChangeRule = new Rule(this, 'MatchConfigChangeRule', {
 *   eventBus: eventBus,
 *   eventPattern: {
 *     source: ['roadcall.admin-config'],
 *     detailType: ['ConfigurationChanged'],
 *     detail: {
 *       configKey: ['matching'], // Only subscribe to matching config changes
 *     },
 *   },
 * });
 * 
 * configChangeRule.addTarget(new LambdaFunction(configChangeHandler));
 */

// ============================================================================
// Example 4: Monitoring configuration usage
// ============================================================================

/**
 * Get cache status for monitoring and debugging
 */
export function getConfigCacheStatus(): void {
  const status = ConfigCache.getCacheStatus();
  
  console.log('Configuration Cache Status:');
  status.forEach((item) => {
    console.log(`  ${item.key}: version ${item.version}, age ${Math.round(item.age / 1000)}s`);
  });

  // Check if any cache entries are stale
  const staleEntries = status.filter((item) => item.age > 120000); // 2 minutes
  if (staleEntries.length > 0) {
    console.warn('Warning: Stale cache entries detected:', staleEntries);
  }
}

// ============================================================================
// Helper functions
// ============================================================================

function calculateDistance(
  point1: { lat: number; lon: number },
  point2: { lat: number; lon: number }
): number {
  // Haversine formula for calculating distance between two points
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lon - point1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// Example 5: Testing configuration changes
// ============================================================================

/**
 * Example test showing how configuration affects matching behavior
 */
async function testConfigurationImpact(): Promise<void> {
  const incident: Incident = {
    incidentId: 'inc-123',
    type: 'tire',
    location: { lat: 40.7128, lon: -74.0060 },
  };

  const vendors: Vendor[] = [
    {
      vendorId: 'v1',
      location: { lat: 40.7580, lon: -73.9855 }, // ~5 miles away
      capabilities: ['tire'],
      availability: 'available',
      metrics: { acceptanceRate: 0.9, avgRating: 4.5 },
    },
    {
      vendorId: 'v2',
      location: { lat: 40.6782, lon: -73.9442 }, // ~10 miles away
      capabilities: ['tire'],
      availability: 'available',
      metrics: { acceptanceRate: 0.7, avgRating: 4.8 },
    },
  ];

  console.log('Testing with current configuration:');
  const config = await ConfigCache.getMatchingConfig();
  console.log('Weights:', config.weights);

  const matches = await findMatchingVendors(incident, vendors);
  console.log('Matched vendors:', matches.map((v) => v.vendorId));

  // Simulate configuration change
  console.log('\nSimulating configuration change...');
  ConfigCache.invalidate('matching');

  // After config change, matching behavior will update automatically
  const newMatches = await findMatchingVendors(incident, vendors);
  console.log('Matched vendors after config change:', newMatches.map((v) => v.vendorId));
}
