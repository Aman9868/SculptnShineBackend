import Redis, { RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'sns:';

export const baseRedisOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  enableReadyCheck: true,
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    // Exponential backoff with jitter, capped at 3000ms
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect when Redis is in READONLY mode (e.g. failover)
      return true;
    }
    return false;
  },
};

/**
 * Creates a new isolated Redis client instance.
 * Useful for BullMQ or PubSub where dedicated connections are required.
 */
export const createRedisClient = (customOptions: Partial<RedisOptions> = {}): Redis => {
  const options: RedisOptions = {
    ...baseRedisOptions,
    ...customOptions,
  };

  const client = new Redis(options);

  client.on('error', (err) => {
    console.error(`[Redis] Connection error (${options.host}:${options.port}):`, err.message);
  });

  return client;
};

/**
 * Primary Redis client singleton for application caching
 */
export const redisClient = createRedisClient({
  keyPrefix: REDIS_KEY_PREFIX,
  maxRetriesPerRequest: 2,
});

redisClient.on('connect', () => {
  console.log(`[Redis] Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}...`);
});

redisClient.on('ready', () => {
  console.log(`[Redis] ✅ Connected & ready (Prefix: "${REDIS_KEY_PREFIX}")`);
});

redisClient.on('reconnecting', (delay: number) => {
  console.warn(`[Redis] ⚠️ Reconnecting in ${delay}ms...`);
});

redisClient.on('close', () => {
  console.warn('[Redis] ⚠️ Connection closed');
});

// Graceful termination handling
const handleProcessExit = async () => {
  try {
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      await redisClient.quit();
      console.log('[Redis] Disconnected gracefully');
    }
  } catch (err) {
    console.error('[Redis] Error during graceful disconnect:', err);
  }
};

process.on('SIGINT', handleProcessExit);
process.on('SIGTERM', handleProcessExit);

export default redisClient;
