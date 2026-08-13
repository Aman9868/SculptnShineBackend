import { Router } from 'express';
import { shippingController } from '../controllers/shipping.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public / User routes
router.get('/', shippingController.getSettings);
router.post('/calculate', shippingController.calculateShipping);

// Admin routes
router.use(authenticate, authorizeRoles('ADMIN'));
router.post('/rules', shippingController.createRule);
router.put('/rules/:id', shippingController.updateRule);
router.delete('/rules/:id', shippingController.deleteRule);
router.put('/settings', shippingController.updateThreshold);

export default router;
