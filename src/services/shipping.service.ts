import { prisma } from '../config/prisma';

export class ShippingService {
  /**
   * Get all shipping rules
   */
  static async getShippingRules() {
    return prisma.shippingRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new shipping rule
   */
  static async createShippingRule(data: { name: string; states: string[]; charge: number; isDefault?: boolean }) {
    if (data.isDefault) {
      await prisma.shippingRule.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.shippingRule.create({
      data,
    });
  }

  /**
   * Update a shipping rule
   */
  static async updateShippingRule(id: string, data: { name?: string; states?: string[]; charge?: number; isDefault?: boolean }) {
    if (data.isDefault) {
      await prisma.shippingRule.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.shippingRule.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a shipping rule
   */
  static async deleteShippingRule(id: string) {
    return prisma.shippingRule.delete({
      where: { id },
    });
  }

  /**
   * Get Store Settings
   */
  static async getStoreSettings() {
    let thresholdSetting = await prisma.storeSetting.findUnique({
      where: { key: 'FREE_SHIPPING_THRESHOLD' },
    });

    if (!thresholdSetting) {
      thresholdSetting = await prisma.storeSetting.create({
        data: {
          key: 'FREE_SHIPPING_THRESHOLD',
          value: '2000',
          description: 'Minimum cart subtotal to qualify for free shipping',
        },
      });
    }

    return {
      FREE_SHIPPING_THRESHOLD: parseFloat(thresholdSetting.value),
    };
  }

  /**
   * Update Free Shipping Threshold
   */
  static async updateFreeShippingThreshold(threshold: number) {
    return prisma.storeSetting.upsert({
      where: { key: 'FREE_SHIPPING_THRESHOLD' },
      update: { value: threshold.toString() },
      create: {
        key: 'FREE_SHIPPING_THRESHOLD',
        value: threshold.toString(),
        description: 'Minimum cart subtotal to qualify for free shipping',
      },
    });
  }

  /**
   * Calculate Shipping for a specific state and subtotal
   */
  static async calculateShipping(state: string, subtotal: number): Promise<{ shippingAmount: number; matchedRule: string }> {
    const settings = await this.getStoreSettings();
    if (subtotal >= settings.FREE_SHIPPING_THRESHOLD) {
      return { shippingAmount: 0, matchedRule: 'Free Shipping Threshold Reached' };
    }

    const rules = await this.getShippingRules();
    
    // Exact match
    const matchedRule = rules.find((rule: any) => 
      rule.states.some((s: string) => s.toLowerCase().trim() === state.toLowerCase().trim())
    );

    if (matchedRule) {
      return { shippingAmount: matchedRule.charge, matchedRule: matchedRule.name };
    }

    // Default match
    const defaultRule = rules.find((rule: any) => rule.isDefault);
    if (defaultRule) {
      return { shippingAmount: defaultRule.charge, matchedRule: defaultRule.name };
    }

    return { shippingAmount: 0, matchedRule: 'No Rule Matched' };
  }
}
