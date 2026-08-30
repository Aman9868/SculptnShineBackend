import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

export class ReplenishmentService {
  /**
   * Extracts the number of servings from a string like "63 Servings(2.31 Kg)"
   * @param weightString The string containing serving info
   * @returns The number of servings as a float, or null if not found
   */
  public static extractServings(weightString: string | null | undefined): number | null {
    if (!weightString) return null;
    
    // Look for a number followed by the word "serving" or "servings" (case insensitive)
    const match = weightString.match(/(\d+)\s*serving/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    
    return null;
  }

  /**
   * Calculates the estimated run out date
   * @param totalServings Total servings in the product variant
   * @param workoutDaysPerWeek How many times the user works out per week
   * @param deliveryDate The date the product was delivered
   * @returns Date when the product is expected to run out
   */
  public static calculateRunOutDate(
    totalServings: number,
    workoutDaysPerWeek: number,
    deliveryDate: Date
  ): Date {
    // Prevent division by zero
    const daysPerWeek = workoutDaysPerWeek > 0 ? workoutDaysPerWeek : 3;
    
    // Calculate total days the product will last
    // Example: 63 servings / 5 days per week = 12.6 weeks
    // 12.6 weeks * 7 days = 88.2 days
    const totalDays = (totalServings / daysPerWeek) * 7;
    
    return addDays(deliveryDate, Math.round(totalDays));
  }

  /**
   * Generates replenishment schedules for all items in a newly delivered order
   * @param orderId The ID of the delivered order
   */
  public static async generateSchedulesForOrder(orderId: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              variant: true,
              product: true
            }
          },
          userProfile: true
        }
      });

      if (!order) return;

      const deliveryDate = new Date(); // Assuming this is called right when marked as DELIVERED
      const workoutDays = order.userProfile.workoutDaysPerWeek || 3;

      for (const item of order.items) {
        if (!item.variantId || !item.productId) continue;

        const servings = this.extractServings(item.variant?.weight || item.variant?.title);
        
        if (servings) {
          const runOutDate = this.calculateRunOutDate(servings, workoutDays, deliveryDate);

          await prisma.replenishmentSchedule.create({
            data: {
              userProfileId: order.userProfileId,
              productId: item.productId,
              variantId: item.variantId,
              orderId: order.id,
              servingsRemaining: servings,
              estimatedRunOutDate: runOutDate,
              notificationStatus: 'PENDING'
            }
          });
          console.log(`[AI] Scheduled replenishment for user ${order.userProfileId} for product ${item.productId} on ${runOutDate.toISOString()}`);
        }
      }
    } catch (error) {
      console.error('[AI] Error generating replenishment schedule:', error);
    }
  }
}
