import Redis, { RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'sns:';

const isServerless = Boolean(
  process.env.VERCEL || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.cwd().startsWith('/var/task')
);

const hasCustomRedis = Boolean(
  (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost' && process.env.REDIS_HOST !== '127.0.0.1') || 
  process.env.REDIS_URL
);

export const baseRedisOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  enableReadyCheck: !isServerless,
  lazyConnect: true,
  maxRetriesPerRequest: isServerless ? 1 : 3,
  retryStrategy(times: number) {
    if (isServerless && !hasCustomRedis) {
      return null; // Immediately fail-open in serverless without blocking or looping
    }
    if (isServerless && times > 2) {
      return null;
    }
    // Exponential backoff with jitter, capped at 3000ms
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err: Error) {
    if (isServerless && !hasCustomRedis) return false;
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
    if (isServerless && !hasCustomRedis) {
      // Fail-open quietly in serverless without flooding logs
      return;
    }
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
