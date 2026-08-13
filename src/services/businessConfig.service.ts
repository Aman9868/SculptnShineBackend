import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BusinessConfigService {
  static async getConfig() {
    // We only have one business config, so we can just fetch the first one
    const config = await prisma.businessConfig.findFirst();
    return config;
  }

  static async upsertConfig(data: {
    brandName: string;
    address: string;
    gstNumber: string;
    supportEmail?: string;
    supportPhone?: string;
    freeShippingThreshold?: number;
    standardShippingCharge?: number;
  }) {
    const existing = await prisma.businessConfig.findFirst();
    if (existing) {
      return await prisma.businessConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      return await prisma.businessConfig.create({
        data,
      });
    }
  }
}
