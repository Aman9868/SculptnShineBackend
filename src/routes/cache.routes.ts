import { Router } from 'express';
import { CacheController } from '../controllers/cache.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Protect cache management endpoints - ADMIN only
router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

router.get('/stats', CacheController.getStats);
router.post('/clear', CacheController.clearCache);

export default router;
