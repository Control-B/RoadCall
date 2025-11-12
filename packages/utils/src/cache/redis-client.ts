import { createClient, RedisClientType } from 'redis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
}

export interface GeoLocation {
  longitude: number;
  latitude: number;
  member: string;
}

export interface GeoSearchOptions {
  radius: number;
  unit: 'km' | 'mi' | 'm' | 'ft';
  count?: number;
  sort?: 'ASC' | 'DESC';
  withDist?: boolean;
  withCoord?: boolean;
}

export interface GeoSearchResult {
  member: string;
  distance?: number;
  coordinates?: {
    longitude: number;
    latitude: number;
  };
}

/**
 * Redis client wrapper with caching and geospatial capabilities
 */
export class RedisClient {
  private client: RedisClientType;
  private connected: boolean = false;
  private readonly defaultTTL: number = 300; // 5 minutes

  constructor(private config: RedisConfig) {
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
        tls: config.tls,
        connectTimeout: config.connectTimeout || 5000,
      },
      password: config.password,
      commandsQueueMaxLength: 1000,
    });

    // Error handling
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis Client Disconnected');
      this.connected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get value by key
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value with optional TTL
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const ttl = options?.ttl || this.defaultTTL;

      const setOptions: any = {
        EX: ttl,
      };

      if (options?.nx) setOptions.NX = true;
      if (options?.xx) setOptions.XX = true;

      const result = await this.client.set(key, stringValue, setOptions);
      return result === 'OK';
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key(s)
   */
  async del(...keys: string[]): Promise<number> {
    try {
      return await this.client.del(keys);
    } catch (error) {
      console.error(`Error deleting keys:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(...keys: string[]): Promise<number> {
    try {
      return await this.client.exists(keys);
    } catch (error) {
      console.error(`Error checking existence:`, error);
      return 0;
    }
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error(`Error setting expiration on ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      console.error(`Error getting multiple keys:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValues: Record<string, any>): Promise<boolean> {
    try {
      const pairs: [string, string][] = Object.entries(keyValues).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]);
      
      const result = await this.client.mSet(pairs);
      return result === 'OK';
    } catch (error) {
      console.error(`Error setting multiple keys:`, error);
      return false;
    }
  }

  /**
   * Increment value
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error(`Error incrementing ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement value
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      console.error(`Error decrementing ${key}:`, error);
      return 0;
    }
  }

  // ============================================
  // Geospatial Operations
  // ============================================

  /**
   * Add geospatial location(s)
   */
  async geoAdd(key: string, locations: GeoLocation[]): Promise<number> {
    try {
      const members = locations.map(loc => ({
        longitude: loc.longitude,
        latitude: loc.latitude,
        member: loc.member,
      }));
      
      return await this.client.geoAdd(key, members);
    } catch (error) {
      console.error(`Error adding geo locations to ${key}:`, error);
      return 0;
    }
  }

  /**
   * Search for members within radius
   */
  async geoRadius(
    key: string,
    longitude: number,
    latitude: number,
    options: GeoSearchOptions
  ): Promise<GeoSearchResult[]> {
    try {
      const searchOptions: any = {
        radius: options.radius,
        unit: options.unit.toUpperCase(),
      };

      if (options.count) searchOptions.count = options.count;
      if (options.sort) searchOptions.sort = options.sort;
      if (options.withDist) searchOptions.withDist = true;
      if (options.withCoord) searchOptions.withCoord = true;

      const results = await this.client.geoRadius(
        key,
        { longitude, latitude },
        options.radius,
        options.unit.toUpperCase() as any,
        searchOptions
      );

      return results.map((result: any) => {
        const geoResult: GeoSearchResult = {
          member: typeof result === 'string' ? result : result.member,
        };

        if (result.distance !== undefined) {
          geoResult.distance = result.distance;
        }

        if (result.coordinates) {
          geoResult.coordinates = {
            longitude: result.coordinates.longitude,
            latitude: result.coordinates.latitude,
          };
        }

        return geoResult;
      });
    } catch (error) {
      console.error(`Error searching geo radius in ${key}:`, error);
      return [];
    }
  }

  /**
   * Get distance between two members
   */
  async geoDist(
    key: string,
    member1: string,
    member2: string,
    unit: 'km' | 'mi' | 'm' | 'ft' = 'km'
  ): Promise<number | null> {
    try {
      return await this.client.geoDist(key, member1, member2, unit.toUpperCase() as any);
    } catch (error) {
      console.error(`Error getting geo distance in ${key}:`, error);
      return null;
    }
  }

  /**
   * Get position of member(s)
   */
  async geoPos(key: string, ...members: string[]): Promise<({ longitude: number; latitude: number } | null)[]> {
    try {
      const positions = await this.client.geoPos(key, members);
      return positions.map(pos => 
        pos ? { longitude: pos.longitude, latitude: pos.latitude } : null
      );
    } catch (error) {
      console.error(`Error getting geo positions in ${key}:`, error);
      return members.map(() => null);
    }
  }

  /**
   * Remove member from geospatial index
   */
  async geoRem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.zRem(key, members);
    } catch (error) {
      console.error(`Error removing geo members from ${key}:`, error);
      return 0;
    }
  }

  // ============================================
  // Hash Operations (for vendor profiles)
  // ============================================

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: any): Promise<number> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.hSet(key, field, stringValue);
    } catch (error) {
      console.error(`Error setting hash field ${field} in ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get hash field
   */
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.client.hGet(key, field);
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Error getting hash field ${field} from ${key}:`, error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall<T = Record<string, any>>(key: string): Promise<T | null> {
    try {
      const hash = await this.client.hGetAll(key);
      if (!hash || Object.keys(hash).length === 0) return null;
      
      // Try to parse each value as JSON
      const parsed: any = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }
      
      return parsed as T;
    } catch (error) {
      console.error(`Error getting all hash fields from ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete hash field(s)
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.client.hDel(key, fields);
    } catch (error) {
      console.error(`Error deleting hash fields from ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check if hash field exists
   */
  async hexists(key: string, field: string): Promise<boolean> {
    try {
      return await this.client.hExists(key, field);
    } catch (error) {
      console.error(`Error checking hash field ${field} in ${key}:`, error);
      return false;
    }
  }
}

/**
 * Create and connect Redis client
 */
export async function createRedisClient(config: RedisConfig): Promise<RedisClient> {
  const client = new RedisClient(config);
  await client.connect();
  return client;
}
