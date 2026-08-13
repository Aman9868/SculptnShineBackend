import { Router } from 'express';
import { SalesController } from '../controllers/sales.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate, authorizeRoles('ADMIN'));

router.get('/kpis', SalesController.getSalesKPIs);
router.get('/analytics', SalesController.getSalesAnalytics);
router.get('/export', SalesController.exportSalesReport);

export const salesRoutes = router;
