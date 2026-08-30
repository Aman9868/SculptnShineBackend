import express from 'express';
import { ReplenishmentController } from '../controllers/replenishment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authenticate);
router.get('/', ReplenishmentController.getMyReplenishments);

export default router;
