import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// User & Admin routes (Authenticated)
router.get('/', authenticate, NotificationController.getMyNotifications);
router.get('/my-notifications', authenticate, NotificationController.getMyNotifications);
router.post('/subscribe', authenticate, NotificationController.subscribe);
router.patch('/all/read', authenticate, NotificationController.markAsRead);
router.patch('/:id/read', authenticate, NotificationController.markAsRead);

// Admin routes (Admin only)
router.post('/admin/broadcast', authenticate, authorizeRoles('ADMIN'), NotificationController.broadcast);
router.get('/admin/all', authenticate, authorizeRoles('ADMIN'), NotificationController.getAllBroadcasts);


export default router;
