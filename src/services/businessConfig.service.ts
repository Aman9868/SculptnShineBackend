import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BusinessConfigService {
  static async getConfig() {
    // We only have one business config, so we can just fetch the first one
    const config = await prisma.businessConfig.findFirst();
    return config;
  }

  static async upsertConfig(data: Partial<{
    brandName: string;
    address: string;
    gstNumber: string;
    supportEmail?: string;
    supportPhone?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    youtubeUrl?: string;
  }>) {
    const existing = await prisma.businessConfig.findFirst();
    if (existing) {
      return await prisma.businessConfig.update({
        where: { id: existing.id },
        data: {
          brandName: data.brandName !== undefined ? data.brandName : existing.brandName,
          address: data.address !== undefined ? data.address : existing.address,
          gstNumber: data.gstNumber !== undefined ? data.gstNumber : existing.gstNumber,
          supportEmail: data.supportEmail !== undefined ? data.supportEmail : existing.supportEmail,
          supportPhone: data.supportPhone !== undefined ? data.supportPhone : existing.supportPhone,
          instagramUrl: data.instagramUrl !== undefined ? data.instagramUrl : existing.instagramUrl,
          facebookUrl: data.facebookUrl !== undefined ? data.facebookUrl : existing.facebookUrl,
          youtubeUrl: data.youtubeUrl !== undefined ? data.youtubeUrl : existing.youtubeUrl,
        },
      });
    } else {
      return await prisma.businessConfig.create({
        data: {
          brandName: data.brandName || 'Sculpt N Shine',
          address: data.address || '',
          gstNumber: data.gstNumber || '',
          supportEmail: data.supportEmail || null,
          supportPhone: data.supportPhone || null,
          instagramUrl: data.instagramUrl || null,
          facebookUrl: data.facebookUrl || null,
          youtubeUrl: data.youtubeUrl || null,
        },
      });
    }
  }
}
