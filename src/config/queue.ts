import { Queue, QueueEvents } from 'bullmq';
import { createRedisClient } from './redis';

export const redisConnection = createRedisClient({
  maxRetriesPerRequest: null,
});

export const notificationQueue = new Queue('notificationQueue', {
  connection: redisConnection,
});

export const notificationQueueEvents = new QueueEvents('notificationQueue', {
  connection: redisConnection,
});

export const addNotificationJob = async (jobName: string, data: any) => {
  return await notificationQueue.add(jobName, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
};

/**
 * Maintenance Queue for background database tasks & log purging
 */
export const maintenanceQueue = new Queue('maintenanceQueue', {
  connection: redisConnection,
});

export const initMaintenanceScheduler = async () => {
  try {
    const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '7', 10);

    // Register repeatable BullMQ job running daily at 03:00 AM (Cron: 0 3 * * *)
    if (typeof (maintenanceQueue as any).upsertJobScheduler === 'function') {
      await (maintenanceQueue as any).upsertJobScheduler(
        'daily_audit_log_cleanup',
        { pattern: '0 3 * * *' },
        {
          name: 'cleanupAuditLogs',
          data: { retentionDays },
        }
      );
    } else {
      await (maintenanceQueue as any).add(
        'cleanupAuditLogs',
        { retentionDays },
        {
          repeat: { pattern: '0 3 * * *' },
          jobId: 'daily_audit_log_cleanup',
          removeOnComplete: 10,
          removeOnFail: 20,
        }
      );
    }

    console.log(`[BullMQ] 🕒 Registered repeatable job "cleanupAuditLogs" at 03:00 AM daily (Retention: ${retentionDays} days)`);
  } catch (error: any) {
    console.error('[BullMQ] Failed to register maintenance scheduler:', error.message);
  }
};

/**
 * Replenishment Queue for AI Predictive Replenishment
 */
export const replenishmentQueue = new Queue('replenishmentQueue', {
  connection: redisConnection,
});

export const initReplenishmentScheduler = async () => {
  try {
    // Register repeatable BullMQ job running daily at 10:00 AM (Cron: 0 10 * * *)
    if (typeof (replenishmentQueue as any).upsertJobScheduler === 'function') {
      await (replenishmentQueue as any).upsertJobScheduler(
        'daily_replenishment_check',
        { pattern: '0 10 * * *' },
        {
          name: 'checkDueReplenishments',
          data: {},
        }
      );
      
      await (replenishmentQueue as any).upsertJobScheduler(
        'daily_google_fit_sync',
        { pattern: '0 2 * * *' }, // Sync at 2:00 AM
        {
          name: 'syncGoogleFitWorkouts',
          data: {},
        }
      );
    } else {
      await (replenishmentQueue as any).add(
        'checkDueReplenishments',
        {},
        {
          repeat: { pattern: '0 10 * * *' },
          jobId: 'daily_replenishment_check',
          removeOnComplete: 10,
          removeOnFail: 20,
        }
      );
      
      await (replenishmentQueue as any).add(
        'syncGoogleFitWorkouts',
        {},
        {
          repeat: { pattern: '0 2 * * *' }, // Sync at 2:00 AM
          jobId: 'daily_google_fit_sync',
          removeOnComplete: 10,
          removeOnFail: 20,
        }
      );
    }

    console.log(`[BullMQ] 🕒 Registered repeatable jobs for AI Predictive Replenishment`);
  } catch (error: any) {
    console.error('[BullMQ] Failed to register replenishment scheduler:', error.message);
  }
};
