import { prisma } from '../config/prisma';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cache.service';

export class BusinessConfigService {
  static async getConfig() {
    const cacheKey = 'businessConfig:all';
    return await cacheService.getOrSet(cacheKey, CACHE_TTL.DAY, async () => {
      return await prisma.businessConfig.findFirst();
    });
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
    let result;

    if (existing) {
      result = await prisma.businessConfig.update({
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
      result = await prisma.businessConfig.create({
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

    await cacheService.delByPattern(CACHE_PATTERNS.BUSINESS_CONFIG);
    return result;
  }
}
