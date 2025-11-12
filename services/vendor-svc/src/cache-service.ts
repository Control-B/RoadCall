import { RedisClient, VendorCache, createRedisClient } from '@roadcall/utils';

let redisClient: RedisClient | null = null;
let vendorCache: VendorCache | null = null;

/**
 * Get or create Redis client singleton
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!redisClient) {
    const redisHost = process.env.REDIS_HOST;
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    if (!redisHost) {
      throw new Error('REDIS_HOST environment variable not set');
    }

    redisClient = await createRedisClient({
      host: redisHost,
      port: redisPort,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });
  }

  return redisClient;
}

/**
 * Get or create vendor cache singleton
 */
export async function getVendorCache(): Promise<VendorCache> {
  if (!vendorCache) {
    const redis = await getRedisClient();
    vendorCache = new VendorCache(redis);
  }

  return vendorCache;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.isConnected();
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
    vendorCache = null;
  }
}
