import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { addNotificationJob } from '../config/queue';

dotenv.config();

const prisma = new PrismaClient();

// Configure web-push with VAPID keys if provided
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@sculptnshine.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (error) {
    console.warn('⚠️ Failed to initialize web-push VAPID details:', error);
  }
} else {
  console.warn('⚠️ VAPID keys not configured. Web push notifications will be disabled.');
}

export class NotificationService {
  /**
   * Subscribes a user's browser endpoint to web push notifications
   */
  static async subscribe(userProfileId: string, subscription: any) {
    const { endpoint, keys } = subscription;
    return await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userProfileId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userProfileId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });
  }

  /**
   * Enqueues a notification to be sent to a single user (e.g. order updates)
   */
  static async sendToUser(
    userProfileId: string,
    title: string,
    message: string,
    type: 'ORDER_UPDATE' | 'PROMO' | 'SYSTEM' = 'SYSTEM',
    link?: string
  ) {
    // 1. Save in-app notification synchronously
    const notification = await prisma.notification.create({
      data: {
        userProfileId,
        title,
        message,
        type,
        link,
      },
    });

    // 2. Queue push notification
    await addNotificationJob('send-single-push', {
      userProfileId,
      notificationId: notification.id,
      title,
      message,
      link,
    });

    return notification;
  }

  /**
   * Enqueues a broadcast notification to all users matching a state filter (or everyone)
   */
  static async broadcast(
    title: string,
    message: string,
    link?: string,
    stateFilter?: string
  ) {
    // We just queue the broadcast job, the worker will handle finding users and fanning out
    await addNotificationJob('send-broadcast-push', {
      title,
      message,
      link,
      stateFilter,
    });
    return { success: true, message: 'Broadcast queued successfully' };
  }

  static async getMyNotifications(userProfileId: string, limit = 20) {
    return await prisma.notification.findMany({
      where: { userProfileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async markAsRead(id: string, userProfileId: string) {
    return await prisma.notification.updateMany({
      where: { id, userProfileId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userProfileId: string) {
    return await prisma.notification.updateMany({
      where: { userProfileId, isRead: false },
      data: { isRead: true },
    });
  }
}
