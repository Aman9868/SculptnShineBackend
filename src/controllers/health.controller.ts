import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

let dynamicMaintenanceMode: {
  enabled: boolean;
  message?: string;
  estimatedEndTime?: string | null;
} = {
  enabled: process.env.MAINTENANCE_MODE === 'true',
  message: process.env.MAINTENANCE_MESSAGE || 'Sculpt N Shine systems are undergoing scheduled maintenance. We will be back shortly.',
  estimatedEndTime: null,
};

export class HealthController {
  /**
   * Public health check endpoint
   * Accessible via /health and /api/health
   */
  static async checkHealth(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    let dbStatus = 'disconnected';
    let dbLatencyMs = 0;

    try {
      // Test database connectivity
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = 'connected';
    } catch (error: any) {
      dbStatus = 'disconnected';
    }

    // Check if maintenance mode is active
    const isMaintenance = dynamicMaintenanceMode.enabled || process.env.MAINTENANCE_MODE === 'true';

    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const healthData = {
      status: isMaintenance ? 'maintenance' : dbStatus === 'connected' ? 'healthy' : 'degraded',
      maintenance: isMaintenance,
      maintenanceMessage: isMaintenance ? dynamicMaintenanceMode.message : null,
      estimatedEndTime: isMaintenance ? dynamicMaintenanceMode.estimatedEndTime : null,
      services: {
        server: {
          status: 'running',
          uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
          uptimeSeconds,
          nodeEnv: process.env.NODE_ENV || 'development',
        },
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
      system: {
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
      },
      version: '1.0.0',
    };

    if (isMaintenance) {
      return res.status(503).json({
        success: false,
        message: dynamicMaintenanceMode.message || 'System under maintenance',
        data: healthData,
      });
    }

    if (dbStatus !== 'connected') {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed',
        data: healthData,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'All systems operational',
      data: healthData,
    });
  }

  /**
   * Admin toggle maintenance mode
   */
  static async toggleMaintenance(req: Request, res: Response, next: NextFunction) {
    try {
      const { enabled, message, estimatedEndTime } = req.body;

      dynamicMaintenanceMode = {
        enabled: typeof enabled === 'boolean' ? enabled : !dynamicMaintenanceMode.enabled,
        message: message || dynamicMaintenanceMode.message,
        estimatedEndTime: estimatedEndTime !== undefined ? estimatedEndTime : dynamicMaintenanceMode.estimatedEndTime,
      };

      return res.status(200).json({
        success: true,
        message: `Maintenance mode ${dynamicMaintenanceMode.enabled ? 'enabled' : 'disabled'}`,
        data: dynamicMaintenanceMode,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get maintenance status
   */
  static async getMaintenanceStatus(req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      data: {
        enabled: dynamicMaintenanceMode.enabled || process.env.MAINTENANCE_MODE === 'true',
        message: dynamicMaintenanceMode.message,
        estimatedEndTime: dynamicMaintenanceMode.estimatedEndTime,
      },
    });
  }
}
