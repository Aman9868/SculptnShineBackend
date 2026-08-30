import redisClient from '../config/redis';
import { DbLoggerService } from './db-logger.service';

const AI_CHANNEL = 'sns:ai:product:events';

export class AISyncService {
  /**
   * Publishes an event to the Redis AI channel when a product is created, updated, or deleted.
   * The Python AI microservice subscribes to this channel to keep its RAG vector store in sync.
   * This operation is fire-and-forget; failures will not block the main product flow.
   */
  static async publishProductEvent(action: string, productId: string, meta: any = {}) {
    try {
      const event = JSON.stringify({
        action,
        productId,
        timestamp: Date.now(),
        ...meta,
      });
      await redisClient.publish(AI_CHANNEL, event);
      console.log(`[AISyncService] Published ${action} event for product ${productId}`);
    } catch (err) {
      console.error('[AISyncService] Failed to publish event:', err);
      // We don't throw here to ensure core product operations are never blocked
    }
  }
}
