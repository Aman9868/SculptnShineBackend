import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', CartController.getCart);
router.post('/items', CartController.addToCart);
router.patch('/items/:id', CartController.updateCartItem);
router.delete('/items/:id', CartController.removeFromCart);
router.delete('/', CartController.clearCart);

export const cartRoutes = router;
