import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

export const redisConnection = new Redis(redisOptions);

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
