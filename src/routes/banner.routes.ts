import { Router } from 'express';
import { BannerController } from '../controllers/banner.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public route — no auth needed (for storefront)
router.get('/public', BannerController.getPublicBanners);

// All routes below require authentication
router.use(authenticate);

router.get('/kpis', authorizeRoles('ADMIN'), BannerController.getBannerKPIs);
router.get('/', BannerController.getAllBanners);
router.get('/:id', BannerController.getBannerById);

router.post('/', authorizeRoles('ADMIN'), BannerController.createBanner);
router.patch('/:id', authorizeRoles('ADMIN'), BannerController.updateBanner);
router.delete('/:id', authorizeRoles('ADMIN'), BannerController.deleteBanner);

export default router;
