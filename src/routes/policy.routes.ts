import { Router } from 'express';
import { PolicyController } from '../controllers/policy.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', PolicyController.getAllPolicies);
router.get('/:id', PolicyController.getPolicyByIdOrType);

// Admin only routes
router.post('/', authenticate, authorizeRoles('ADMIN'), PolicyController.createPolicy);
router.put('/:id', authenticate, authorizeRoles('ADMIN'), PolicyController.updatePolicy);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), PolicyController.deletePolicy);

export default router;
