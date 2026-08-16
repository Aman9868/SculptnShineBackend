import { redisClient } from '../config/redis';

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRatio: string;
  isConnected: boolean;
  status: string;
}

export const CACHE_TTL = {
  SHORT: 60,            // 1 minute (high volatility)
  DEFAULT: 300,         // 5 minutes (standard lists, search queries)
  MEDIUM: 900,          // 15 minutes (product details, filters)
  LONG: 3600,           // 1 hour (categories, brands, banners)
  DAY: 86400,           // 24 hours (static business configs, policies)
};

export const CACHE_PATTERNS = {
  PRODUCTS: 'products:*',
  CATEGORIES: 'categories:*',
  SUBCATEGORIES: 'subcategories:*',
  BRANDS: 'brands:*',
  BANNERS: 'banners:*',
  BUSINESS_CONFIG: 'businessConfig:*',
  POLICIES: 'policies:*',
  GUIDES: 'guides:*',
  REVIEWS: 'reviews:*',
};

class CacheService {
  private hits = 0;
  private misses = 0;
  private errors = 0;

  /**
   * Check if Redis connection is active and ready
   */
  public isConnected(): boolean {
    return redisClient.status === 'ready';
  }

  /**
   * Ping Redis server to verify connectivity and latency
   */
  public async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await redisClient.ping();
      return { ok: res === 'PONG', latencyMs: Date.now() - start };
    } catch (err) {
      this.errors++;
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Retrieve cached value by key with fail-open error handling
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) {
      this.misses++;
      return null;
    }

    try {
      const data = await redisClient.get(key);
      if (data) {
        this.hits++;
        return JSON.parse(data) as T;
      }
      this.misses++;
      return null;
    } catch (error: any) {
      this.errors++;
      console.warn(`[Cache] Error reading key "${key}":`, error.message);
      return null;
    }
  }

  /**
   * Store a value in cache with optional TTL in seconds
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL.DEFAULT): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (error: any) {
      this.errors++;
      console.warn(`[Cache] Error setting key "${key}":`, error.message);
      return false;
    }
  }

  /**
   * Delete one or more specific keys
   */
  public async del(keys: string | string[]): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    try {
      const keyList = Array.isArray(keys) ? keys : [keys];
      if (keyList.length === 0) return 0;
      return await redisClient.del(...keyList);
    } catch (error: any) {
      this.errors++;
      console.warn(`[Cache] Error deleting key(s):`, error.message);
      return 0;
    }
  }

  /**
   * Invalidate all keys matching a pattern using non-blocking SCAN.
   * Handles ioredis keyPrefix transparently.
   */
  public async delByPattern(pattern: string): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    try {
      const prefix = (redisClient.options.keyPrefix as string) || '';
      const searchPattern = prefix ? `${prefix}${pattern}` : pattern;
      let cursor = '0';
      let totalDeleted = 0;

      do {
        // Scan in batches of 100 to avoid blocking the Redis main thread
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          searchPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          // If keyPrefix is active, strip prefix before calling client.del()
          // because ioredis automatically prepends keyPrefix to del commands
          const rawKeys = prefix
            ? keys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k))
            : keys;

          if (rawKeys.length > 0) {
            const deleted = await redisClient.del(...rawKeys);
            totalDeleted += deleted;
          }
        }
      } while (cursor !== '0');

      return totalDeleted;
    } catch (error: any) {
      this.errors++;
      console.warn(`[Cache] Error deleting pattern "${pattern}":`, error.message);
      return 0;
    }
  }

  /**
   * Helper to retrieve from cache or execute fallback fetcher and cache the result.
   * Guaranteed fail-open: If Redis is down, it seamlessly executes fetcher().
   */
  public async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const freshData = await fetcher();

    // Cache asynchronously to avoid adding latency to the response
    if (freshData !== null && freshData !== undefined) {
      this.set(key, freshData, ttlSeconds).catch((err) => {
        console.warn(`[Cache] Background set failed for key "${key}":`, err.message);
      });
    }

    return freshData;
  }

  /**
   * Invalidate multiple domain patterns simultaneously
   */
  public async invalidatePatterns(patterns: string[]): Promise<number> {
    let total = 0;
    for (const pattern of patterns) {
      total += await this.delByPattern(pattern);
    }
    return total;
  }

  /**
   * Flush all application cache keys (matching the app prefix)
   */
  public async flushAppCache(): Promise<number> {
    return await this.delByPattern('*');
  }

  /**
   * Returns cache metrics & connection diagnostics
   */
  public getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? `${((this.hits / totalRequests) * 100).toFixed(2)}%` : '0.00%';

    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRatio,
      isConnected: this.isConnected(),
      status: redisClient.status,
    };
  }
}

export const cacheService = new CacheService();
export default cacheService;
