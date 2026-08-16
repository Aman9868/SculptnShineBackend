import { Request, Response, NextFunction } from 'express';
import { resourceMetricsService } from '../services/resource-metrics.service';
import { cacheService } from '../services/cache.service';

export class ResourceMetricsController {
  /**
   * GET /api/system/metrics
   * Returns comprehensive system resource metrics and history
   */
  static async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await resourceMetricsService.getMetrics();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/system/purge-cache
   * Admin trigger to flush Redis cache
   */
  static async purgeCache(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await cacheService.delByPattern('*');
      res.status(200).json({
        success: true,
        message: `Cache purged successfully. Cleared keys matching pattern.`,
        deletedCount: count,
      });
    } catch (error) {
      next(error);
    }
  }
}
