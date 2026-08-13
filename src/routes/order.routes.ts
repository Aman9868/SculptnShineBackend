import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public tracking endpoint
router.post('/track', OrderController.trackOrder);

router.use(authenticate);

router.post('/', OrderController.createOrder);
router.get('/my-orders', OrderController.getUserOrders);
router.get('/admin-all', authorizeRoles('ADMIN'), OrderController.getAdminOrders);
router.get('/:id', OrderController.getOrderById);
router.get('/:id/invoice', OrderController.downloadInvoice);
router.patch('/:id/status', authorizeRoles('ADMIN'), OrderController.updateOrderStatus);
router.post('/:id/cancel', OrderController.cancelOrder);

export const orderRoutes = router;
