import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Protect all WhatsApp admin routes
router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

// Get WhatsApp connection status
router.get('/status', WhatsAppController.getStatus);

// Request / Refresh QR Code
router.get('/qr', WhatsAppController.getQR);

// Disconnect / Unlink WhatsApp session
router.post('/disconnect', WhatsAppController.disconnect);

// Toggle automated customer notifications
router.post('/toggle-automation', WhatsAppController.toggleAutomation);

// Send test message
router.post('/test-message', WhatsAppController.sendTestMessage);

export default router;
