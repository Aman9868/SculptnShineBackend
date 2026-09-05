import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', authorizeRoles('ADMIN'), SearchController.globalSearch);

export default router;

