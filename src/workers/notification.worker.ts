import { Worker } from 'bullmq';
import { redisConnection } from '../config/queue';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import dotenv from 'dotenv';
import { NotificationChannelService } from '../services/notification-channel.service';

dotenv.config();

const prisma = new PrismaClient();

type NotificationProfile = {
  id: string;
  phone: string | null;
  webPushNotifications: boolean;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  user: {
    email: string;
  };
};

const sendWebPush = async (subscription: any, payload: any) => {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    );
  } catch (error: any) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log('Subscription has expired or is no longer valid: ', subscription.endpoint);
      await prisma.pushSubscription.delete({ where: { id: subscription.id } });
    } else {
      console.error('Error sending push notification:', error);
    }
  }
};

const deliverProfileChannels = async (
  profiles: NotificationProfile[],
  payload: { title: string; message: string; link?: string }
) => {
  const emailTargets = profiles.filter((profile) => profile.emailNotifications && profile.user.email);
  const whatsappTargets = profiles.filter((profile) => profile.whatsappNotifications && profile.phone);

  const emailResults = await Promise.allSettled(
    emailTargets.map((profile) =>
      NotificationChannelService.sendEmail(profile.user.email, payload)
    )
  );

  emailResults.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Email notification failed:', result.reason);
    }
  });

  const whatsappResults = await Promise.allSettled(
    whatsappTargets.map((profile) =>
      NotificationChannelService.sendWhatsApp(profile.phone as string, payload)
    )
  );

  whatsappResults.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('WhatsApp notification failed:', result.reason);
    }
  });
};

export const notificationWorker = new Worker(
  'notificationQueue',
  async (job) => {
    const { name, data } = job;

    if (name === 'send-single-push') {
      const { userProfileId, title, message, link } = data;

      const profile = await prisma.userProfile.findUnique({
        where: { id: userProfileId },
        select: {
          id: true,
          phone: true,
          webPushNotifications: true,
          emailNotifications: true,
          whatsappNotifications: true,
          user: { select: { email: true } },
        },
      });

      if (!profile) return;
      
      const subscriptions = profile.webPushNotifications
        ? await prisma.pushSubscription.findMany({ where: { userProfileId } })
        : [];

      const payload = { title, body: message, url: link };
      
      await Promise.all(
        subscriptions.map((sub) => sendWebPush(sub, payload))
      );

      await deliverProfileChannels([profile], { title, message, link });
    } 
    
    else if (name === 'send-broadcast-push') {
      const { title, message, link, stateFilter } = data;

      const profiles = await prisma.userProfile.findMany({
        where: stateFilter
          ? {
              addresses: {
                some: {
                  state: stateFilter,
                  isDefault: true,
                },
              },
            }
          : {},
        select: {
          id: true,
          phone: true,
          webPushNotifications: true,
          emailNotifications: true,
          whatsappNotifications: true,
          user: { select: { email: true } },
        },
      });

      const userProfileIds = profiles.map((profile) => profile.id);

      if (userProfileIds.length === 0) return;

      // 1. Bulk create in-app notifications
      await prisma.notification.createMany({
        data: userProfileIds.map((id) => ({
          userProfileId: id,
          title,
          message,
          link,
          type: 'PROMO',
        })),
        skipDuplicates: true,
      });

      // 2. Fetch all valid subscriptions for these users
      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          userProfileId: {
            in: profiles
              .filter((profile) => profile.webPushNotifications)
              .map((profile) => profile.id),
          },
        },
      });

      const payload = { title, body: message, url: link };

      // Fan out web push requests
      // Using Promise.all is fine for smaller sets, but in a massive prod env we might chunk it
      const chunks = [];
      for (let i = 0; i < subscriptions.length; i += 100) {
        chunks.push(subscriptions.slice(i, i + 100));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map((sub) => sendWebPush(sub, payload)));
      }

      await deliverProfileChannels(profiles, { title, message, link });
    }
  },
  { connection: redisConnection }
);

notificationWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

notificationWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});
