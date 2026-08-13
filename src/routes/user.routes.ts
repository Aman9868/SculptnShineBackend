import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateUserSchema, changePasswordSchema, adminCreateUserSchema } from '../validators/user.validator';

const router = Router();

// Protect all user routes
router.use(authenticate);

// Create a new user (Admin only)
router.post('/', authorizeRoles('ADMIN'), validate(adminCreateUserSchema), UserController.createUser);

// List all users with pagination (Admin only)
router.get('/', authorizeRoles('ADMIN'), UserController.getAllUsers);

// Export all users (Admin only)
router.get('/export', authorizeRoles('ADMIN'), UserController.exportUsers);

// Get user KPIs (Admin only)
router.get('/kpis', authorizeRoles('ADMIN'), UserController.getUserKPIs);

// Get specific user or own profile ('me')
router.get('/:id', UserController.getUserProfile);

// Update specific user or own profile ('me')
router.patch('/:id', validate(updateUserSchema), UserController.updateUserProfile);

// Change password
router.patch('/:id/password', validate(changePasswordSchema), UserController.changePassword);

export default router;
