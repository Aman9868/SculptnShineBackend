import { Router } from 'express';
import { BrandController } from '../controllers/brand.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Specific routes (must precede /:id)
router.get('/kpis', authenticate, authorizeRoles('ADMIN'), BrandController.getBrandKPIs);
router.get('/top-selling', BrandController.getTopSellingBrands);
router.get('/', BrandController.getAllBrands);
router.get('/:id', BrandController.getBrandById);

// Protected routes for admin management
router.use(authenticate);

router.post('/', authorizeRoles('ADMIN'), BrandController.createBrand);
router.patch('/:id', authorizeRoles('ADMIN'), BrandController.updateBrand);
router.delete('/:id', authorizeRoles('ADMIN'), BrandController.deleteBrand);

export default router;

