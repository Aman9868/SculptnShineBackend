import { Router, Request, Response } from 'express';
import { AuditLogService } from '../services/audit.service';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Only ADMINs can view audit logs
router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await AuditLogService.getRecentLogs(limit, page);
    
    res.status(200).json({
      success: true,
      message: 'Audit logs fetched successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

export default router;
