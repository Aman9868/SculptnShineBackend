import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cache.service';

export class CacheController {
  /**
   * Get real-time cache statistics and health
   */
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = cacheService.getStats();
      const ping = await cacheService.ping();

      res.status(200).json({
        success: true,
        message: 'Cache statistics retrieved',
        data: {
          ...stats,
          ping,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear cache by pattern or entire application cache
   */
  static async clearCache(req: Request, res: Response, next: NextFunction) {
    try {
      const { pattern } = req.body;
      let deletedCount = 0;

      if (pattern && typeof pattern === 'string') {
        deletedCount = await cacheService.delByPattern(pattern);
      } else {
        deletedCount = await cacheService.flushAppCache();
      }

      res.status(200).json({
        success: true,
        message: pattern ? `Cache cleared for pattern: ${pattern}` : 'Entire application cache flushed successfully',
        deletedKeys: deletedCount,
      });
    } catch (error) {
      next(error);
    }
  }
}
