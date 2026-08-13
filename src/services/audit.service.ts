import { prisma } from '../config/prisma';

export class AuditLogService {
  /**
   * Log an action in the audit log
   * @param action The action performed (e.g. "Updated Profile", "Logged In")
   * @param entity The entity affected (e.g. "User", "Order", "System")
   * @param userId The ID of the user performing the action (optional for system events)
   * @param details Any additional metadata stored as JSON
   */
  static async log(action: string, entity: string, userId?: string, details?: any) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity,
          userId,
          details,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // We don't want audit logging failures to crash the main request
    }
  }

  /**
   * Get recent audit logs with pagination
   */
  static async getRecentLogs(limit: number = 10, page: number = 1) {
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count(),
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
}
