import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Internal route for AI service to send quotations (protected by a simple API key check or open for MVP)
router.post('/send-quotation', (req, res, next) => {
    // Simple basic protection for internal AI service calls
    const apiKey = req.headers['x-api-key'];
    if (process.env.AI_API_KEY && apiKey !== process.env.AI_API_KEY) {
        // Only block if AI_API_KEY is defined and mismatch (fail open for local dev MVP if not set)
        return res.status(401).json({ success: false, message: 'Unauthorized AI client' });
    }
    next();
}, WhatsAppController.sendQuotation);

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
