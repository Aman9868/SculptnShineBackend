import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { errorMiddleware } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import shippingRoutes from './routes/shipping.routes';
import auditRoutes from './routes/audit.routes';
import categoryRoutes from './routes/category.routes';
import brandRoutes from './routes/brand.routes';
import { subcategoryRoutes } from './routes/subcategory.routes';
import { productRoutes } from './routes/product.routes';
import { cartRoutes } from './routes/cart.routes';
import { orderRoutes } from './routes/order.routes';
import { paymentRoutes } from './routes/payment.routes';
import { salesRoutes } from './routes/sales.routes';
import bannerRoutes from './routes/banner.routes';
import addressRoutes from './routes/address.routes';
import wishlistRoutes from './routes/wishlist.routes';
import businessConfigRoutes from './routes/businessConfig.routes';
import policyRoutes from './routes/policy.routes';
import ticketRoutes from './routes/ticket.routes';
import reviewRoutes from './routes/review.routes';
import supportInfoRoutes from './routes/support-info.routes';
import guideRoutes from './routes/guide.routes';
import notificationRoutes from './routes/notification.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import healthRoutes from './routes/health.routes';
import emailConfigRoutes from './routes/email-config.routes';
import replenishmentRoutes from './routes/replenishment.routes';
import { couponRoutes } from './routes/coupon.routes';
import cacheRoutes from './routes/cache.routes';
import resourceMetricsRoutes from './routes/resource-metrics.routes';
import { integrationRoutes } from './routes/integration.routes';
import searchRoutes from './routes/search.routes';
import { HealthController } from './controllers/health.controller';
import { requestContextMiddleware } from './config/request-context';
import { WhatsAppSessionService } from './services/whatsapp-session.service';
import { initMaintenanceScheduler, initReplenishmentScheduler } from './config/queue';
import './workers/notification.worker'; // Initialize BullMQ notification worker
import './workers/maintenance.worker'; // Initialize BullMQ maintenance worker
import './workers/replenishment.worker'; // Initialize BullMQ replenishment worker

import os from 'os';

// Detect serverless environment (Vercel, AWS Lambda) where filesystem is read-only (/var/task)
const isServerless = Boolean(
  process.env.VERCEL || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.cwd().startsWith('/var/task')
);

// Only initialize persistent background socket connections and workers outside serverless
if (!isServerless) {
  // Initialize WhatsApp direct multi-device session
  WhatsAppSessionService.init().catch(err => {
    console.error('[WhatsApp] Background initialization error:', err);
  });

  // Initialize automated BullMQ background log retention scheduler (Runs daily at 03:00 AM)
  initMaintenanceScheduler().catch(err => {
    console.warn('[BullMQ] Maintenance scheduler warning:', err);
  });

  // Initialize automated BullMQ replenishment scheduler (Runs daily at 10:00 AM)
  initReplenishmentScheduler().catch(err => {
    console.warn('[BullMQ] Replenishment scheduler warning:', err);
  });
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestContextMiddleware);

// Serve static files from 'uploads' directory with CORS and fallback
const uploadsPath = isServerless 
  ? path.join(os.tmpdir(), 'uploads') 
  : path.resolve(process.cwd(), 'uploads');

try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
} catch (error) {
  console.warn(`[App] Notice: Could not create uploads directory at ${uploadsPath}:`, error);
}

app.use('/uploads', express.static(uploadsPath, {
  maxAge: '7d',
  etag: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Missing static upload fallback
app.use('/uploads', (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'production' && process.env.PRODUCTION_MEDIA_URL) {
    return res.redirect(`${process.env.PRODUCTION_MEDIA_URL}/uploads${req.path}`);
  }
  return res.status(404).json({ success: false, message: 'File not found' });
});

// Serve invoices from the 'public/invoices' directory
const invoicesPath = isServerless
  ? path.join(os.tmpdir(), 'invoices')
  : path.resolve(process.cwd(), 'public/invoices');

try {
  if (!fs.existsSync(invoicesPath)) {
    fs.mkdirSync(invoicesPath, { recursive: true });
  }
} catch (error) {
  console.warn(`[App] Notice: Could not create invoices directory at ${invoicesPath}:`, error);
}
app.use('/invoices', express.static(invoicesPath, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/replenishments', replenishmentRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/business-config', businessConfigRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/support', ticketRoutes);
app.use('/api/support/info', supportInfoRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/email-config', emailConfigRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/admin/cache', cacheRoutes);
app.use('/api/system', resourceMetricsRoutes);
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/health', HealthController.checkHealth);

// Error handling middleware
app.use(errorMiddleware);

export default app;
