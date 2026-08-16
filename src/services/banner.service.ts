import { prisma } from '../config/prisma';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cache.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class BannerService {
  private static async invalidateBannerCache() {
    await cacheService.delByPattern(CACHE_PATTERNS.BANNERS);
  }

  static async getAllBanners(query: { search?: string; type?: string; status?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.type) {
      if (query.type.includes(',')) {
        where.type = { in: query.type.split(',').map((t) => t.trim()) };
      } else {
        where.type = query.type;
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { subtitle: { contains: query.search, mode: 'insensitive' } },
        { ctaText: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [banners, total] = await Promise.all([
      prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          product: { select: { slug: true, title: true } },
          category: { select: { slug: true, name: true } },
          brand: { select: { slug: true, name: true } }
        }
      }),
      prisma.banner.count({ where }),
    ]);

    return {
      banners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getBannerById(id: string) {
    const cacheKey = `banners:id:${id}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const banner = await prisma.banner.findUnique({ 
        where: { id },
        include: {
          product: { select: { slug: true, title: true } },
          category: { select: { slug: true, name: true } },
          brand: { select: { slug: true, name: true } }
        }
      });

      if (!banner) {
        throw createError(404, 'Banner not found');
      }

      return banner;
    });
  }

  static async createBanner(data: {
    title: string;
    subtitle?: string;
    image?: string;
    video?: string;
    link?: string;
    ctaText?: string;
    type?: any;
    targetType?: any;
    status?: any;
    sortOrder?: number;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    productId?: string;
    brandId?: string;
  }) {
    if (!data.title || !data.title.trim()) {
      throw createError(400, 'Banner title is required');
    }

    if ((!data.image || !data.image.trim()) && (!data.video || !data.video.trim())) {
      throw createError(400, 'Either Banner image or video is required');
    }

    // Auto-calculate sort order if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      const maxOrder = await prisma.banner.aggregate({
        where: { type: data.type || 'HOME_GENERAL' },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder || 0) + 1;
    }

    const banner = await prisma.banner.create({
      data: {
        title: data.title.trim(),
        subtitle: data.subtitle?.trim() || null,
        image: data.image?.trim() || '',
        video: data.video?.trim() || null,
        link: data.link?.trim() || null,
        ctaText: data.ctaText?.trim() || null,
        type: data.type || 'HOME_GENERAL',
        targetType: data.targetType || 'NONE',
        status: data.status || 'ACTIVE',
        sortOrder,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        categoryId: data.categoryId || null,
        productId: data.productId || null,
        brandId: data.brandId || null,
      },
    });

    await this.invalidateBannerCache();
    return banner;
  }

  static async updateBanner(id: string, data: any) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw createError(404, 'Banner not found');
    }

    const updated = await prisma.banner.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        subtitle: data.subtitle !== undefined ? (data.subtitle?.trim() || null) : undefined,
        image: data.image !== undefined ? (data.image?.trim() || '') : undefined,
        video: data.video !== undefined ? (data.video?.trim() || null) : undefined,
        link: data.link !== undefined ? (data.link?.trim() || null) : undefined,
        ctaText: data.ctaText !== undefined ? (data.ctaText?.trim() || null) : undefined,
        type: data.type || undefined,
        targetType: data.targetType || undefined,
        status: data.status || undefined,
        sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : undefined,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
        categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
        productId: data.productId !== undefined ? (data.productId || null) : undefined,
        brandId: data.brandId !== undefined ? (data.brandId || null) : undefined,
      },
    });

    await this.invalidateBannerCache();
    return updated;
  }

  static async deleteBanner(id: string) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw createError(404, 'Banner not found');
    }

    await prisma.banner.delete({ where: { id } });
    await this.invalidateBannerCache();
    return { success: true, message: `Banner '${existing.title}' deleted successfully` };
  }

  static async getBannerKPIs() {
    const [
      total, 
      active, 
      inactive, 
      scheduled, 
      homeGeneralCount, 
      promoCount, 
      categoryHeaderCount, 
      brandHeaderCount,
      loginBgCount,
      signupBgCount,
      homeProductCount
    ] = await Promise.all([
      prisma.banner.count(),
      prisma.banner.count({ where: { status: 'ACTIVE' } }),
      prisma.banner.count({ where: { status: 'INACTIVE' } }),
      prisma.banner.count({ where: { status: 'SCHEDULED' } }),
      prisma.banner.count({ where: { type: 'HOME_GENERAL' } }),
      prisma.banner.count({ where: { type: 'PROMO' } }),
      prisma.banner.count({ where: { type: 'CATEGORY_HEADER' } }),
      prisma.banner.count({ where: { type: 'BRAND_HEADER' } }),
      prisma.banner.count({ where: { type: 'LOGIN_BG' } }),
      prisma.banner.count({ where: { type: 'SIGNUP_BG' } }),
      prisma.banner.count({ where: { type: 'HOME_PRODUCT' } }),
    ]);

    return { 
      total, 
      active, 
      inactive, 
      scheduled, 
      homeGeneralCount, 
      promoCount, 
      categoryHeaderCount, 
      brandHeaderCount, 
      authBgCount: loginBgCount + signupBgCount,
      homeProductCount
    };
  }

  static async getPublicBanners(type?: string) {
    const cacheKey = `banners:public:${type || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const where: any = { status: 'ACTIVE' };

      if (type) {
        where.type = type;
      }

      // Filter out scheduled banners that are not yet active or have expired
      const now = new Date();
      where.OR = [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ];

      return await prisma.banner.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          product: { select: { slug: true, title: true } },
          category: { select: { slug: true, name: true } },
          brand: { select: { slug: true, name: true } }
        }
      });
    });
  }
}
