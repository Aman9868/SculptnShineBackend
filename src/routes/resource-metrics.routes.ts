import { Router } from 'express';
import { ResourceMetricsController } from '../controllers/resource-metrics.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Secure system metrics endpoint for Admins
router.get('/metrics', authenticate, authorizeRoles('ADMIN'), ResourceMetricsController.getMetrics);
router.post('/purge-cache', authenticate, authorizeRoles('ADMIN'), ResourceMetricsController.purgeCache);

export default router;
