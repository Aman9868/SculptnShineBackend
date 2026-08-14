import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// User routes (Authenticated)
router.post('/subscribe', authenticate, NotificationController.subscribe);
router.get('/my-notifications', authenticate, NotificationController.getMyNotifications);
router.patch('/:id/read', authenticate, NotificationController.markAsRead);

// Admin routes (Admin only)
router.post('/admin/broadcast', authenticate, authorizeRoles('ADMIN'), NotificationController.broadcast);
router.get('/admin/all', authenticate, authorizeRoles('ADMIN'), NotificationController.getAllBroadcasts);


export default router;
