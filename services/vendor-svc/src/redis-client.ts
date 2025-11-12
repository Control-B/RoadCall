import { createClient, RedisClientType } from 'redis';
import { logger } from '@roadcall/utils';

let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

  redisClient = createClient({
    socket: {
      host: redisHost,
      port: redisPort,
      tls: process.env.REDIS_TLS === 'true',
    },
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', err);
  });

  await redisClient.connect();
  logger.info('Redis client connected', { host: redisHost, port: redisPort });

  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client disconnected');
  }
}
