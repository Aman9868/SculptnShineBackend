import { Router } from 'express';
import { WishlistController } from '../controllers/wishlist.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Protect all wishlist routes
router.use(authenticate);

// Toggle product in wishlist
router.post('/:productId/toggle', WishlistController.toggleWishlist);

// Get user's wishlist
router.get('/', WishlistController.getWishlist);

export default router;
