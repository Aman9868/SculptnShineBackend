import { Router } from 'express';
import { BusinessConfigController } from '../controllers/businessConfig.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public/Admin route to get business config
router.get('/', BusinessConfigController.getConfig);

// Admin only route to update business config
router.put('/', authenticate, authorizeRoles('ADMIN'), BusinessConfigController.updateConfig);

export default router;
