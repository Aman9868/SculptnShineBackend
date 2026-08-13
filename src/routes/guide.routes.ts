import { Router } from 'express';
import { guideController } from '../controllers/guide.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', guideController.getAllGuides);
router.get('/:id', guideController.getGuideById);
router.get('/slug/:slug', guideController.getGuideBySlug);

// Admin routes
router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

router.post('/', guideController.createGuide);
router.patch('/:id', guideController.updateGuide);
router.delete('/:id', guideController.deleteGuide);

export default router;
