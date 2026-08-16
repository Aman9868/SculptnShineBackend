import { Request, Response, NextFunction } from 'express';
import { cacheService, CACHE_TTL } from '../services/cache.service';

export interface CacheMiddlewareOptions {
  ttl?: number;
  prefix?: string;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

/**
 * Standard HTTP Cache Key generator based on route and query string
 */
export const defaultCacheKeyGenerator = (req: Request, prefix: string = 'http'): string => {
  const cleanPath = (req.baseUrl + req.path).replace(/\/$/, '') || '/';
  const queryKeys = Object.keys(req.query).sort();
  const queryString = queryKeys.length > 0
    ? `?${queryKeys.map((k) => `${k}=${encodeURIComponent(String(req.query[k]))}`).join('&')}`
    : '';

  return `${prefix}:${cleanPath}${queryString}`;
};

/**
 * Express Middleware for transparent HTTP response caching in Redis
 */
export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  const ttl = options.ttl || CACHE_TTL.DEFAULT;
  const prefix = options.prefix || 'http';
  const keyGen = options.keyGenerator || ((req: Request) => defaultCacheKeyGenerator(req, prefix));

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Bypass cache if client specifically requests no-cache
    if (req.headers['cache-control'] === 'no-cache' || req.headers['pragma'] === 'no-cache') {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    // Custom condition check if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    const cacheKey = keyGen(req);

    try {
      const cachedResponse = await cacheService.get<{
        status: number;
        headers: Record<string, string>;
        body: any;
      }>(cacheKey);

      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);

        if (cachedResponse.headers) {
          Object.entries(cachedResponse.headers).forEach(([header, value]) => {
            if (!res.getHeader(header)) {
              res.setHeader(header, value);
            }
          });
        }

        return res.status(cachedResponse.status || 200).json(cachedResponse.body);
      }

      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);

      res.json = function (body: any): Response {
        // Only cache successful 200 responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body) {
          cacheService
            .set(
              cacheKey,
              {
                status: res.statusCode,
                headers: {
                  'Content-Type': 'application/json',
                },
                body,
              },
              ttl
            )
            .catch((err) => {
              console.warn(`[Cache Middleware] Failed to cache key "${cacheKey}":`, err.message);
            });
        }

        return originalJson(body);
      };

      next();
    } catch (err: any) {
      console.warn(`[Cache Middleware] Failed for key "${cacheKey}":`, err.message);
      next();
    }
  };
};

export default cacheMiddleware;
