import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
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
import { requestContextMiddleware } from './config/request-context';
import './workers/notification.worker'; // Initialize BullMQ worker


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestContextMiddleware);

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve invoices from the 'public/invoices' directory
app.use('/invoices', express.static(path.join(__dirname, '../public/invoices')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'SculptnShine Backend is running' });
});

// Error handling middleware
app.use(errorMiddleware);

export default app;
