import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/queue';
import { AuditLogService } from '../services/audit.service';

/**
 * BullMQ Worker for System Maintenance Tasks
 */
export const maintenanceWorker = new Worker(
  'maintenanceQueue',
  async (job: Job) => {
    console.log(`[BullMQ Maintenance Worker] ⚙️ Processing job "${job.name}" (ID: ${job.id})`);

    switch (job.name) {
      case 'cleanupAuditLogs': {
        const retentionDays = Number(job.data?.retentionDays) || 7;
        const result = await AuditLogService.cleanupOldLogs(retentionDays);
        return {
          success: true,
          deletedCount: result.deletedCount,
          cutoffDate: result.cutoffDate,
        };
      }

      default:
        console.warn(`[BullMQ Maintenance Worker] Unknown job name: ${job.name}`);
        return { success: false, reason: 'Unknown job name' };
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

maintenanceWorker.on('completed', (job: Job, result: any) => {
  console.log(`[BullMQ Maintenance Worker] ✅ Job "${job.name}" completed successfully:`, result);
});

maintenanceWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[BullMQ Maintenance Worker] ❌ Job "${job?.name}" failed:`, err.message);
});

maintenanceWorker.on('error', (err: Error) => {
  console.error('[BullMQ Maintenance Worker] Redis worker error:', err.message);
});

export default maintenanceWorker;
