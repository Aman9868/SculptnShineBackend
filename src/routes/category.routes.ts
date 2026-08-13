import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';

const router = Router();

// Global authentication removed because GET /categories should be public


// Admin only routes for managing categories
router.post('/', authenticate, authorizeRoles('ADMIN'), validate(createCategorySchema), CategoryController.createCategory);
router.patch('/:id', authenticate, authorizeRoles('ADMIN'), validate(updateCategorySchema), CategoryController.updateCategory);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), CategoryController.deleteCategory);

// Public/Authenticated routes for viewing categories
router.get('/kpis', authenticate, authorizeRoles('ADMIN'), CategoryController.getCategoryKPIs);
router.get('/export', authenticate, authorizeRoles('ADMIN'), CategoryController.exportCategories);
router.get('/', CategoryController.getAllCategories);
router.get('/:id/filters', CategoryController.getCategoryFilters);
router.get('/:id', CategoryController.getCategoryById);

export default router;
