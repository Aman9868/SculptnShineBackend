import { Router } from 'express';
import multer from 'multer';
import { ProductController } from '../controllers/product.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const router = Router();

router.get('/inventory-status', authenticate, authorizeRoles('ADMIN'), ProductController.getInventoryStatus);
router.get('/sample-template', authenticate, authorizeRoles('ADMIN'), ProductController.getSampleTemplate);
router.get('/export-excel', authenticate, authorizeRoles('ADMIN'), ProductController.exportProductsExcel);
router.get('/filters', ProductController.getFilters);
router.get('/best-sellers', ProductController.getBestSellers);
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);

router.post('/bulk-upload', authenticate, authorizeRoles('ADMIN'), upload.single('file'), ProductController.bulkUpload);
router.post('/', authenticate, authorizeRoles('ADMIN'), ProductController.createProduct);
router.patch('/:id', authenticate, authorizeRoles('ADMIN'), ProductController.updateProduct);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), ProductController.deleteProduct);

export const productRoutes = router;

