import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public health checks
router.get('/', HealthController.checkHealth);
router.get('/status', HealthController.getMaintenanceStatus);

// Admin-only maintenance control
router.post('/maintenance', authenticate, authorizeRoles('ADMIN'), HealthController.toggleMaintenance);

export default router;
