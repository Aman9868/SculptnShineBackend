import { Router } from 'express';
import { SubcategoryController } from '../controllers/subcategory.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/kpis', authorizeRoles('ADMIN'), SubcategoryController.getSubcategoryKPIs);
router.get('/export', authorizeRoles('ADMIN'), SubcategoryController.exportSubcategories);

router.get('/', SubcategoryController.getAllSubcategories);
router.get('/:id', SubcategoryController.getSubcategoryById);

router.post('/', authorizeRoles('ADMIN'), SubcategoryController.createSubcategory);
router.patch('/:id', authorizeRoles('ADMIN'), SubcategoryController.updateSubcategory);
router.delete('/:id', authorizeRoles('ADMIN'), SubcategoryController.deleteSubcategory);

export const subcategoryRoutes = router;
