/**
 * Example: How to subscribe to configuration changes in your service
 * 
 * This example shows how to:
 * 1. Subscribe to ConfigurationChanged events via EventBridge
 * 2. Refresh cached configuration when changes occur
 * 3. Use the ConfigCache utility for hot-reload support
 */

import { EventBridgeEvent } from 'aws-lambda';
import { ConfigCache } from '../src/utils/config-cache';
import { ConfigKey } from '../src/types/config';

/**
 * EventBridge event payload for configuration changes
 */
interface ConfigurationChangedDetail {
  configKey: ConfigKey;
  version: number;
  updatedBy: string;
  updatedAt: string;
  changeType: 'created' | 'updated';
}

/**
 * Lambda handler that processes configuration change events
 * This handler should be triggered by an EventBridge rule
 */
export const handler = async (
  event: EventBridgeEvent<'ConfigurationChanged', ConfigurationChangedDetail>
): Promise<void> => {
  console.log('Configuration change detected:', event.detail);

  const { configKey, version, changeType } = event.detail;

  // Invalidate the cache for this configuration
  ConfigCache.invalidate(configKey);

  console.log(`Cache invalidated for ${configKey} (version ${version}, ${changeType})`);

  // Optionally, pre-fetch the new configuration to warm the cache
  try {
    switch (configKey) {
      case 'matching':
        await ConfigCache.getMatchingConfig();
        console.log('Matching config cache warmed');
        break;
      case 'sla-tiers':
        await ConfigCache.getSLAConfig();
        console.log('SLA config cache warmed');
        break;
      default:
        console.log(`No cache warming implemented for ${configKey}`);
    }
  } catch (error) {
    console.error('Error warming cache:', error);
    // Don't throw - cache will be populated on next access
  }
};

/**
 * Example: Using ConfigCache in your service
 */
export async function exampleServiceFunction() {
  // Get matching configuration with automatic caching and hot-reload
  const matchingConfig = await ConfigCache.getMatchingConfig();

  console.log('Current matching weights:', matchingConfig.weights);
  console.log('Default search radius:', matchingConfig.defaultRadius);

  // Use the configuration in your business logic
  const searchRadius = matchingConfig.defaultRadius;
  const distanceWeight = matchingConfig.weights.distance;

  // Configuration will be automatically refreshed within 60 seconds
  // when changes are published via EventBridge
}

/**
 * Example: CDK EventBridge Rule to subscribe to configuration changes
 * 
 * Add this to your service's CDK stack:
 * 
 * ```typescript
 * import { Rule } from 'aws-cdk-lib/aws-events';
 * import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
 * 
 * // Create EventBridge rule to listen for config changes
 * const configChangeRule = new Rule(this, 'ConfigChangeRule', {
 *   eventBus: eventBus,
 *   eventPattern: {
 *     source: ['roadcall.admin-config'],
 *     detailType: ['ConfigurationChanged'],
 *     detail: {
 *       configKey: ['matching'], // Subscribe to specific config keys
 *     },
 *   },
 * });
 * 
 * // Add your Lambda function as a target
 * configChangeRule.addTarget(new LambdaFunction(configRefreshHandler));
 * ```
 */

/**
 * Example: Monitoring cache status
 */
export function monitorCacheStatus() {
  const status = ConfigCache.getCacheStatus();
  
  console.log('Configuration cache status:');
  status.forEach(({ key, version, age }) => {
    const ageSeconds = Math.floor(age / 1000);
    console.log(`  ${key}: version ${version}, age ${ageSeconds}s`);
  });

  // Alert if cache is stale (older than 2 minutes)
  const staleConfigs = status.filter(s => s.age > 120000);
  if (staleConfigs.length > 0) {
    console.warn('Stale configurations detected:', staleConfigs);
  }
}

/**
 * Example: Manual cache invalidation
 * Use this if you need to force a refresh outside of EventBridge events
 */
export function forceConfigRefresh() {
  // Invalidate all cached configurations
  ConfigCache.invalidateAll();
  console.log('All configuration caches invalidated');
}
