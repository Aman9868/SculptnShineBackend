import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Initiation requires user auth
router.post('/initiate/:orderId', authenticate, PaymentController.initiatePayment);

// PhonePe Webhook / Callback endpoint (public GET & POST)
router.post('/phonepe/callback', PaymentController.handleCallback);
router.get('/phonepe/callback', PaymentController.handleCallback);

// Status check endpoint
router.get('/status/:merchantTransactionId', authenticate, PaymentController.verifyStatus);

export const paymentRoutes = router;
