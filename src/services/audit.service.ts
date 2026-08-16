import { prisma } from '../config/prisma';

export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  entity?: string;
  action?: string;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export class AuditLogService {
  /**
   * Fetch paginated and filtered journal / audit logs
   */
  static async getLogs(options: AuditLogQueryOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.entity && options.entity !== 'ALL') {
      where.entity = options.entity;
    }

    if (options.action && options.action !== 'ALL') {
      where.action = options.action;
    }

    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (options.search && options.search.trim()) {
      const query = options.search.trim();
      where.OR = [
        { action: { contains: query, mode: 'insensitive' } },
        { entity: { contains: query, mode: 'insensitive' } },
        { entityId: { contains: query, mode: 'insensitive' } },
        { userEmail: { contains: query, mode: 'insensitive' } },
        { ipAddress: { contains: query, mode: 'insensitive' } },
        { user: { firstName: { contains: query, mode: 'insensitive' } } },
        { user: { lastName: { contains: query, mode: 'insensitive' } } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
      ];
    }

    const [logs, total] = await Promise.all([
      (prisma as any).auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      (prisma as any).auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get aggregated journal log statistics for dashboard KPI cards
   */
  static async getStats() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      total,
      todayCount,
      orderCount,
      paymentCount,
      productCount,
      authCount,
      failureCount,
      recentEntities,
    ] = await Promise.all([
      (prisma as any).auditLog.count(),
      (prisma as any).auditLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      (prisma as any).auditLog.count({ where: { entity: 'Order' } }),
      (prisma as any).auditLog.count({ where: { entity: 'Payment' } }),
      (prisma as any).auditLog.count({ where: { entity: { in: ['Product', 'Category', 'Brand', 'CatalogSearch'] } } }),
      (prisma as any).auditLog.count({ where: { entity: 'Auth' } }),
      (prisma as any).auditLog.count({ where: { status: 'FAILED' } }),
      (prisma as any).auditLog.groupBy({
        by: ['entity'],
        _count: { entity: true },
        orderBy: { _count: { entity: 'desc' } },
        take: 8,
      }),
    ]);

    return {
      total,
      todayCount,
      orderAndPaymentCount: orderCount + paymentCount,
      catalogCount: productCount,
      authCount,
      failureCount,
      entityBreakdown: recentEntities.map((e: any) => ({
        entity: e.entity,
        count: e._count.entity,
      })),
    };
  }

  /**
   * Export filtered journal logs as CSV
   */
  static async exportLogs(options: AuditLogQueryOptions = {}) {
    const { logs } = await this.getLogs({ ...options, limit: 1000, page: 1 });

    const headers = ['ID', 'Timestamp', 'Status', 'Entity', 'Entity ID', 'Action', 'User Name', 'User Email', 'IP Address', 'Details'];
    const rows = [headers.join(',')];

    for (const log of logs) {
      const userName = log.user ? `"${log.user.firstName} ${log.user.lastName}"` : '""';
      const userEmail = log.user?.email || log.userEmail || '';
      const detailsStr = log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : '""';

      rows.push([
        log.id,
        log.createdAt.toISOString(),
        log.status,
        `"${log.entity}"`,
        `"${log.entityId || ''}"`,
        `"${log.action}"`,
        userName,
        `"${userEmail}"`,
        `"${log.ipAddress || ''}"`,
        detailsStr,
      ].join(','));
    }

    return rows.join('\n');
  }

  /**
   * Delete journal logs older than specified retention days (default: 7 days)
   */
  static async cleanupOldLogs(retentionDays: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await (prisma as any).auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[AuditLogService] 🧹 Purged ${result.count} logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

    return {
      deletedCount: result.count,
      cutoffDate,
      retentionDays,
    };
  }

  /**
   * Legacy method support for backward compatibility
   */
  static async getRecentLogs(limit: number = 10, page: number = 1) {
    return this.getLogs({ limit, page });
  }

  /**
   * Legacy log method
   */
  static async log(action: string, entity: string, userId?: string, details?: any) {
    try {
      await (prisma as any).auditLog.create({
        data: {
          action,
          entity,
          userId,
          details,
          status: 'SUCCESS',
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
}

export default AuditLogService;
