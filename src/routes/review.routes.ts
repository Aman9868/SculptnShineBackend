import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// --- Public Routes ---
// GET /api/reviews/featured
router.get('/featured', reviewController.getFeaturedReviews);

// GET /api/reviews/product/:productId
router.get('/product/:productId', reviewController.getProductReviews);

// --- User Routes (Require Auth) ---
// GET /api/reviews/eligibility/:productId
router.get('/eligibility/:productId', authenticate, reviewController.checkEligibility);

// POST /api/reviews
router.post('/', authenticate, reviewController.addReview);

// --- Admin Routes ---
// POST /api/reviews/admin (Admin creates a review)
router.post('/admin', authenticate, authorizeRoles('ADMIN'), reviewController.addAdminReview);

// GET /api/reviews/admin/list
router.get('/admin/list', authenticate, authorizeRoles('ADMIN'), reviewController.getAllReviewsAdmin);

// PATCH /api/reviews/admin/:id/status
router.patch('/admin/:id/status', authenticate, authorizeRoles('ADMIN'), reviewController.updateReviewStatus);

// PATCH /api/reviews/admin/:id
router.patch('/admin/:id', authenticate, authorizeRoles('ADMIN'), reviewController.updateReview);

// DELETE /api/reviews/admin/:id
router.delete('/admin/:id', authenticate, authorizeRoles('ADMIN'), reviewController.deleteReview);

export default router;
