import { Router } from 'express';
import { EmailConfigController } from '../controllers/email-config.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

router.get('/', EmailConfigController.getConfig);
router.put('/', EmailConfigController.updateConfig);
router.post('/test', EmailConfigController.testConnection);
router.post('/send-test', EmailConfigController.sendTestEmail);

export default router;
