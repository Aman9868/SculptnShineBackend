import { Router } from 'express';
import { supportInfoController } from '../controllers/support-info.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', supportInfoController.getAllSupportInfo);
router.get('/:id', supportInfoController.getSupportInfoById);

// Admin routes
router.post('/', authenticate, authorizeRoles('ADMIN'), supportInfoController.createSupportInfo);
router.patch('/:id', authenticate, authorizeRoles('ADMIN'), supportInfoController.updateSupportInfo);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), supportInfoController.deleteSupportInfo);

export default router;
