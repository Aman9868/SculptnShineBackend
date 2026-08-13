import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/inventory-status', authenticate, authorizeRoles('ADMIN'), ProductController.getInventoryStatus);
router.get('/filters', ProductController.getFilters);
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

router.post('/', authenticate, authorizeRoles('ADMIN'), ProductController.createProduct);
router.patch('/:id', authenticate, authorizeRoles('ADMIN'), ProductController.updateProduct);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), ProductController.deleteProduct);

export const productRoutes = router;
