import { Queue, Worker, QueueEvents } from 'bullmq';
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
