import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/queue';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notification.service';
import { WhatsAppSessionService } from '../services/whatsapp-session.service';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

/**
 * BullMQ Worker for AI Predictive Replenishment Tasks
 */
export const replenishmentWorker = new Worker(
  'replenishmentQueue',
  async (job: Job) => {
    console.log(`[BullMQ Replenishment Worker] ⚙️ Processing job "${job.name}" (ID: ${job.id})`);

    switch (job.name) {
      case 'checkDueReplenishments': {
        const now = new Date();
        const cutoffDate = addDays(now, 5); // Check for replenishments due within the next 5 days

        const dueSchedules = await prisma.replenishmentSchedule.findMany({
          where: {
            estimatedRunOutDate: {
              lte: cutoffDate
            },
            notificationStatus: 'PENDING'
          },
          include: {
            userProfile: {
              include: { user: true }
            },
            product: true,
            variant: true
          }
        });

        console.log(`[AI] Found ${dueSchedules.length} replenishments due soon.`);

        // Fetch Admin Support Number for alerts
        const supportInfo = await prisma.supportInfo.findFirst({
          where: { type: 'GENERAL' }
        });
        const adminWhatsApp = supportInfo?.whatsappNumber;

        let processedCount = 0;

        for (const schedule of dueSchedules) {
          const user = schedule.userProfile.user;
          const phone = schedule.userProfile.phone;
          const productName = schedule.variant?.title || schedule.product?.title || 'your product';
          const productLink = `/product/${schedule.product?.slug}`;

          // 1. Send Push Notification to User
          if (schedule.userProfile.webPushNotifications) {
            try {
              await NotificationService.sendToUser(
                schedule.userProfileId,
                'Time to Restock! 📦',
                `Hey ${user.firstName}, you might be running low on ${productName}. Order now to not miss a day!`,
                'PROMO',
                productLink
              );
            } catch (e) {
              console.error(`[AI] Failed to send push to ${user.email}:`, e);
            }
          }

          // 2. Send WhatsApp Notification to User
          let whatsappSent = false;
          if (schedule.userProfile.whatsappNotifications && phone) {
            try {
              const waMessage = `*Time to Restock!* 📦\n\nHey ${user.firstName}, our AI predicts you'll run out of *${productName}* soon based on your workout routine.\n\nKeep your progress going! Reorder here: https://sculptnshine.shop${productLink}`;
              
              const waResult = await WhatsAppSessionService.sendMessage(phone, waMessage);
              whatsappSent = waResult.sent;
            } catch (e) {
              console.error(`[AI] Failed to send WhatsApp to ${phone}:`, e);
            }
          }

          // 3. Send WhatsApp Alert to Admin
          if (adminWhatsApp) {
            try {
              const adminAlert = `*⚠️ AI Replenishment Alert*\n\nUser: ${user.firstName} ${user.lastName}\nPhone: ${phone || 'N/A'}\nDue to restock: *${productName}*\nWhatsApp Notified: ${whatsappSent ? 'Yes' : 'No'}`;
              await WhatsAppSessionService.sendMessage(adminWhatsApp, adminAlert);
            } catch (e) {
              console.error(`[AI] Failed to alert Admin WhatsApp ${adminWhatsApp}:`, e);
            }
          }

          // Update Schedule Status
          await prisma.replenishmentSchedule.update({
            where: { id: schedule.id },
            data: {
              notificationStatus: 'NOTIFIED',
              lastNotifiedAt: new Date()
            }
          });
          
          processedCount++;
        }

        return {
          success: true,
          processedCount,
        };
      }

      case 'syncGoogleFitWorkouts': {
        // Find all active Google Fit integrations
        const integrations = await prisma.externalIntegration.findMany({
          where: { provider: 'GOOGLE_FIT', isActive: true }
        });

        console.log(`[Google Fit Sync] Found ${integrations.length} active integrations to sync.`);
        
        let syncedCount = 0;
        
        // Using GoogleFitService to sync each user's workouts
        // We import it inside the function to avoid circular dependencies if any, but better to import at top.
        const { GoogleFitService } = await import('../services/google-fit.service');
        
        for (const integration of integrations) {
          try {
            await GoogleFitService.syncUserWorkouts(integration.userProfileId);
            syncedCount++;
          } catch (error) {
            console.error(`[Google Fit Sync] Failed to sync for user ${integration.userProfileId}:`, error);
          }
        }
        
        return {
          success: true,
          syncedCount
        };
      }

      default:
        console.warn(`[BullMQ Replenishment Worker] Unknown job name: ${job.name}`);
        return { success: false, reason: 'Unknown job name' };
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

replenishmentWorker.on('completed', (job: Job, result: any) => {
  console.log(`[BullMQ Replenishment Worker] ✅ Job "${job.name}" completed successfully:`, result);
});

replenishmentWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[BullMQ Replenishment Worker] ❌ Job "${job?.name}" failed:`, err.message);
});

replenishmentWorker.on('error', (err: Error) => {
  console.error('[BullMQ Replenishment Worker] Redis worker error:', err.message);
});

export default replenishmentWorker;
