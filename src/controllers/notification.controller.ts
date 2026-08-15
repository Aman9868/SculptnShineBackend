import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { prisma } from '../config/prisma';


export class NotificationController {
  static async subscribe(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!userProfile) {
        userProfile = await prisma.userProfile.create({ data: { userId } });
      }

      const userProfileId = userProfile.id;

      const { subscription } = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: 'Invalid subscription data' });
      }

      await NotificationService.subscribe(userProfileId, subscription);
      return res.status(200).json({ success: true, message: 'Subscribed successfully' });
    } catch (error: any) {
      console.error('Subscription error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!userProfile) {
        userProfile = await prisma.userProfile.create({ data: { userId } });
      }

      const userProfileId = userProfile.id;

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;

      // If user is Admin, ensure past orders have notification entries if table is empty
      if (userRole === 'ADMIN') {
        const count = await prisma.notification.count({ where: { type: 'ORDER_UPDATE' } });
        if (count === 0) {
          const recentOrders = await prisma.order.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
          });
          for (const ord of recentOrders) {
            await prisma.notification.create({
              data: {
                userProfileId,
                title: ord.status === 'PAID' ? 'Payment Completed! 💳' : 'New Order Received! 🛍️',
                message: `Order #${ord.orderNumber} for ₹${ord.totalAmount} by ${ord.shippingName || 'Customer'}.`,
                type: 'ORDER_UPDATE',
                link: `/orders/${ord.id}`,
                createdAt: ord.createdAt,
              },
            }).catch(() => {});
          }
        }
      }

      // If user is Admin, return all admin order and payment notifications + direct notifications
      const notifications = await prisma.notification.findMany({
        where: userRole === 'ADMIN'
          ? {
              OR: [
                { userProfileId },
                { type: 'ORDER_UPDATE' },
              ],
            }
          : { userProfileId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      
      return res.status(200).json({ success: true, data: notifications });
    } catch (error: any) {
      console.error('Fetch notifications error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!userProfile) {
        userProfile = await prisma.userProfile.create({ data: { userId } });
      }

      const userProfileId = userProfile.id;
      const id = req.params.id as string;
      
      if (id === 'all') {
        await NotificationService.markAllAsRead(userProfileId);
      } else {
        await NotificationService.markAsRead(id, userProfileId);
      }
      
      return res.status(200).json({ success: true, message: 'Marked as read' });
    } catch (error: any) {
      console.error('Mark read error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin Route
  static async broadcast(req: Request, res: Response) {
    try {
      const { title, message, link, stateFilter } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Title and message are required' });
      }

      const result = await NotificationService.broadcast(title, message, link, stateFilter);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Broadcast error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllBroadcasts(req: Request, res: Response) {
    try {
      const notifications = await prisma.notification.findMany({
        where: { type: 'PROMO' },
        orderBy: { createdAt: 'desc' },
      });
      
      const uniqueBroadcasts: any[] = [];
      const seen = new Set<string>();
      
      for (const n of notifications) {
        const key = `${n.title}-${n.message}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueBroadcasts.push(n);
        }
      }
      
      return res.status(200).json({ success: true, data: uniqueBroadcasts });
    } catch (error: any) {
      console.error('Fetch broadcasts error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
