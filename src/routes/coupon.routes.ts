import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public / Customer routes
router.get('/vouchers', CouponController.getPublicVouchers);
router.get('/announcement', CouponController.getAnnouncement);
router.post('/validate', authenticate, CouponController.validate);

// Admin routes
router.post('/', authenticate, authorizeRoles('ADMIN'), CouponController.create);
router.get('/admin', authenticate, authorizeRoles('ADMIN'), CouponController.getAll);
router.get('/admin/:id', authenticate, authorizeRoles('ADMIN'), CouponController.getById);
router.put('/admin/:id', authenticate, authorizeRoles('ADMIN'), CouponController.update);
router.patch('/admin/:id/status', authenticate, authorizeRoles('ADMIN'), CouponController.toggleStatus);
router.delete('/admin/:id', authenticate, authorizeRoles('ADMIN'), CouponController.delete);

export const couponRoutes = router;
