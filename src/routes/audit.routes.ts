import { Router, Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services/audit.service';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Only ADMINs can view and export audit/journal logs
router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

/**
 * GET /api/audit-logs/stats
 * Get aggregated statistics for the journal log dashboard
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await AuditLogService.getStats();
    res.status(200).json({
      success: true,
      message: 'Audit log statistics fetched successfully',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/export
 * Export filtered journal logs as CSV
 */
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csvData = await AuditLogService.exportLogs(req.query as any);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="journal-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/audit-logs/cleanup
 * Manually trigger cleanup of logs older than retention days (default: 7 days)
 */
router.post('/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const retentionDays = Number(req.body?.retentionDays) || 7;
    const result = await AuditLogService.cleanupOldLogs(retentionDays);
    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCount} logs older than ${retentionDays} days`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs
 * Get paginated, searchable, and filtered journal logs
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuditLogService.getLogs(req.query as any);
    res.status(200).json({
      success: true,
      message: 'Audit logs fetched successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
