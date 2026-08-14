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

      const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!userProfile) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
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
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!userProfile) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
      }

      const userProfileId = userProfile.id;

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const notifications = await NotificationService.getMyNotifications(userProfileId, limit);
      
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

      const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!userProfile) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
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
