import { ConfigManager } from './config-manager';
import { ConfigKey, MatchingConfig, SLAConfig, DEFAULT_MATCHING_CONFIG, DEFAULT_SLA_CONFIG } from '../types/config';

/**
 * Configuration cache with TTL and hot-reload support
 * Services should use this class to access configuration with automatic refresh
 */
export class ConfigCache {
  private static cache: Map<ConfigKey, { value: any; timestamp: number; version: number }> = new Map();
  private static readonly TTL_MS = 60000; // 60 seconds

  /**
   * Get matching configuration with caching
   */
  static async getMatchingConfig(): Promise<MatchingConfig> {
    return this.getConfig<MatchingConfig>('matching', DEFAULT_MATCHING_CONFIG);
  }

  /**
   * Get SLA configuration with caching
   */
  static async getSLAConfig(): Promise<SLAConfig> {
    return this.getConfig<SLAConfig>('sla-tiers', DEFAULT_SLA_CONFIG);
  }

  /**
   * Generic config getter with caching
   */
  private static async getConfig<T>(configKey: ConfigKey, defaultValue: T): Promise<T> {
    const cached = this.cache.get(configKey);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && (now - cached.timestamp) < this.TTL_MS) {
      return cached.value as T;
    }

    // Fetch fresh configuration
    try {
      const config = await ConfigManager.getLatestConfig(configKey);
      
      if (config) {
        this.cache.set(configKey, {
          value: config.value,
          timestamp: now,
          version: config.version,
        });
        return config.value as T;
      }
    } catch (error) {
      console.error(`Error fetching config ${configKey}:`, error);
      
      // Return cached value even if expired, better than failing
      if (cached) {
        console.warn(`Using expired cache for ${configKey}`);
        return cached.value as T;
      }
    }

    // Return default if no config exists
    return defaultValue;
  }

  /**
   * Invalidate cache for a specific config key
   * Call this when receiving ConfigurationChanged event
   */
  static invalidate(configKey: ConfigKey): void {
    this.cache.delete(configKey);
    console.log(`Cache invalidated for ${configKey}`);
  }

  /**
   * Invalidate all cached configurations
   */
  static invalidateAll(): void {
    this.cache.clear();
    console.log('All config cache invalidated');
  }

  /**
   * Get current cache status for monitoring
   */
  static getCacheStatus(): Array<{ key: string; version: number; age: number }> {
    const now = Date.now();
    const status: Array<{ key: string; version: number; age: number }> = [];

    this.cache.forEach((value, key) => {
      status.push({
        key,
        version: value.version,
        age: now - value.timestamp,
      });
    });

    return status;
  }
}
