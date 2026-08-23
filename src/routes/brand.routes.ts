import { Router } from 'express';
import { BrandController } from '../controllers/brand.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public routes (no auth needed)
router.get('/', BrandController.getAllBrands);
router.get('/:id', BrandController.getBrandById);

// Protected routes
router.use(authenticate);

router.get('/kpis', authorizeRoles('ADMIN'), BrandController.getBrandKPIs);
router.post('/', authorizeRoles('ADMIN'), BrandController.createBrand);
router.patch('/:id', authorizeRoles('ADMIN'), BrandController.updateBrand);
router.delete('/:id', authorizeRoles('ADMIN'), BrandController.deleteBrand);

export default router;
