import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

const db = prisma as any;

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class CouponService {
  /**
   * Create a new coupon (Admin)
   */
  static async createCoupon(data: {
    code: string;
    title: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderAmount?: number;
    scopeType: 'GENERAL' | 'CATEGORY' | 'BRAND' | 'PRODUCT' | 'SEASONAL';
    applicableProductIds?: string[];
    applicableCategoryIds?: string[];
    applicableBrandIds?: string[];
    startDate?: Date | string;
    endDate: Date | string;
    usageLimit?: number;
    usageLimitPerUser?: number;
    isActive?: boolean;
    isPublic?: boolean;
    badgeText?: string;
    bannerText?: string;
  }) {
    const formattedCode = data.code.trim().toUpperCase();

    // Check if code already exists
    const existing = await db.coupon.findUnique({
      where: { code: formattedCode },
    });

    if (existing) {
      throw createError(400, `Coupon with code '${formattedCode}' already exists`);
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      throw createError(400, 'End date must be after start date');
    }

    if (data.discountValue <= 0) {
      throw createError(400, 'Discount value must be greater than 0');
    }

    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      throw createError(400, 'Percentage discount cannot exceed 100%');
    }

    const coupon = await db.coupon.create({
      data: {
        code: formattedCode,
        title: data.title,
        description: data.description,
        discountType: data.discountType,
        discountValue: Number(data.discountValue),
        maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : 0,
        scopeType: data.scopeType || 'GENERAL',
        applicableProductIds: data.applicableProductIds || [],
        applicableCategoryIds: data.applicableCategoryIds || [],
        applicableBrandIds: data.applicableBrandIds || [],
        startDate,
        endDate,
        usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
        usageLimitPerUser: data.usageLimitPerUser ? Number(data.usageLimitPerUser) : 1,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
        badgeText: data.badgeText || (data.discountType === 'PERCENTAGE' ? `Save ${data.discountValue}%` : `Save ₹${data.discountValue}`),
        bannerText: data.bannerText,
      },
    });

    return coupon;
  }

  /**
   * Get all coupons with filters & metrics (Admin)
   */
  static async getAdminCoupons(query: {
    page?: number;
    limit?: number;
    search?: string;
    scopeType?: string;
    status?: string; // 'ACTIVE', 'INACTIVE', 'EXPIRED'
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const now = new Date();
    const where: any = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.scopeType && query.scopeType !== 'ALL') {
      where.scopeType = query.scopeType;
    }

    if (query.status === 'ACTIVE') {
      where.isActive = true;
      where.endDate = { gte: now };
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    } else if (query.status === 'EXPIRED') {
      where.endDate = { lt: now };
    }

    const [total, coupons, allCouponsForMetrics, totalSavingsAgg] = await Promise.all([
      db.coupon.count({ where }),
      db.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { usages: true, orders: true },
          },
        },
      }),
      db.coupon.findMany({
        select: {
          id: true,
          isActive: true,
          endDate: true,
          usedCount: true,
        },
      }),
      db.couponUsage.aggregate({
        _sum: { discountAmount: true },
      }),
    ]);

    const activeCount = allCouponsForMetrics.filter((c: any) => c.isActive && new Date(c.endDate) >= now).length;
    const totalRedemptions = allCouponsForMetrics.reduce((sum: number, c: any) => sum + (c.usedCount || 0), 0);
    const totalDiscountGranted = totalSavingsAgg._sum.discountAmount || 0;

    return {
      coupons,
      metrics: {
        totalCoupons: allCouponsForMetrics.length,
        activeCoupons: activeCount,
        totalRedemptions,
        totalDiscountGranted,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single coupon details (Admin)
   */
  static async getCouponById(id: string) {
    const coupon = await db.coupon.findUnique({
      where: { id },
      include: {
        usages: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            userProfile: {
              select: {
                id: true,
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      throw createError(404, 'Coupon not found');
    }

    return coupon;
  }

  /**
   * Update coupon (Admin)
   */
  static async updateCoupon(id: string, data: any) {
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) throw createError(404, 'Coupon not found');

    if (data.code && data.code.trim().toUpperCase() !== existing.code) {
      const codeCheck = await db.coupon.findUnique({
        where: { code: data.code.trim().toUpperCase() },
      });
      if (codeCheck) throw createError(400, 'Coupon code already in use');
    }

    const updatePayload: any = { ...data };
    if (data.code) updatePayload.code = data.code.trim().toUpperCase();
    if (data.startDate) updatePayload.startDate = new Date(data.startDate);
    if (data.endDate) updatePayload.endDate = new Date(data.endDate);
    if (data.discountValue !== undefined) updatePayload.discountValue = Number(data.discountValue);
    if (data.maxDiscountAmount !== undefined) updatePayload.maxDiscountAmount = data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null;
    if (data.minOrderAmount !== undefined) updatePayload.minOrderAmount = Number(data.minOrderAmount);
    if (data.usageLimit !== undefined) updatePayload.usageLimit = data.usageLimit ? Number(data.usageLimit) : null;
    if (data.usageLimitPerUser !== undefined) updatePayload.usageLimitPerUser = Number(data.usageLimitPerUser);

    const updated = await db.coupon.update({
      where: { id },
      data: updatePayload,
    });

    return updated;
  }

  /**
   * Toggle status (Admin)
   */
  static async toggleCouponStatus(id: string) {
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) throw createError(404, 'Coupon not found');

    const updated = await db.coupon.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return updated;
  }

  /**
   * Delete coupon (Admin)
   */
  static async deleteCoupon(id: string) {
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) throw createError(404, 'Coupon not found');

    await db.coupon.delete({ where: { id } });
    return { success: true, message: 'Coupon deleted successfully' };
  }

  /**
   * Fetch visible public coupons / vouchers for storefront
   */
  static async getPublicCoupons(params?: {
    productId?: string;
    categoryId?: string;
    brandId?: string;
  }) {
    const now = new Date();
    const where: any = {
      isActive: true,
      isPublic: true,
      startDate: { lte: now },
      endDate: { gte: now },
    };

    const coupons = await db.coupon.findMany({
      where,
      orderBy: { discountValue: 'desc' },
    });

    // Filter coupons matching the target criteria if specified
    if (!params || (!params.productId && !params.categoryId && !params.brandId)) {
      return coupons;
    }

    return coupons.filter((c: any) => {
      if (c.scopeType === 'GENERAL' || c.scopeType === 'SEASONAL' || c.scopeType === 'FIRST_ORDER') return true;
      if (c.scopeType === 'PRODUCT' && params.productId) {
        return c.applicableProductIds.includes(params.productId);
      }
      if (c.scopeType === 'CATEGORY' && params.categoryId) {
        return c.applicableCategoryIds.includes(params.categoryId);
      }
      if (c.scopeType === 'BRAND' && params.brandId) {
        return c.applicableBrandIds.includes(params.brandId);
      }
      return false;
    });
  }

  /**
   * Get featured announcement coupon (strictly FIRST_ORDER coupons only)
   */
  static async getFeaturedAnnouncement() {
    const now = new Date();
    const firstOrderCoupon = await db.coupon.findFirst({
      where: {
        isActive: true,
        isPublic: true,
        scopeType: 'FIRST_ORDER',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    if (!firstOrderCoupon) return null;

    return {
      id: firstOrderCoupon.id,
      code: firstOrderCoupon.code,
      title: firstOrderCoupon.title,
      bannerText: firstOrderCoupon.bannerText,
      badgeText: firstOrderCoupon.badgeText,
      discountType: firstOrderCoupon.discountType,
      discountValue: firstOrderCoupon.discountValue,
      scopeType: firstOrderCoupon.scopeType,
    };
  }

  /**
   * Validate and calculate discount for cart checkout
   */
  static async validateAndCalculateDiscount(
    code: string,
    userProfileId: string,
    cartItems: any[],
    subtotal: number
  ) {
    if (!code || !code.trim()) {
      throw createError(400, 'Please enter a coupon code');
    }

    const formattedCode = code.trim().toUpperCase();
    const now = new Date();

    const coupon = await db.coupon.findUnique({
      where: { code: formattedCode },
    });

    if (!coupon) {
      throw createError(404, `Coupon code '${formattedCode}' is invalid`);
    }

    if (!coupon.isActive) {
      throw createError(400, `Coupon '${formattedCode}' is currently inactive`);
    }

    if (now < new Date(coupon.startDate)) {
      throw createError(400, `Coupon '${formattedCode}' starts on ${new Date(coupon.startDate).toLocaleDateString()}`);
    }

    if (now > new Date(coupon.endDate)) {
      throw createError(400, `Coupon '${formattedCode}' has expired`);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw createError(400, `Coupon '${formattedCode}' has reached its total usage limit`);
    }

    // Check user's previous redemptions
    if (userProfileId) {
      const userUsageCount = await db.couponUsage.count({
        where: {
          couponId: coupon.id,
          userProfileId,
        },
      });

      if (userUsageCount >= coupon.usageLimitPerUser) {
        throw createError(
          400,
          `You have already used this coupon the maximum allowed times (${coupon.usageLimitPerUser})`
        );
      }

      // Check FIRST_ORDER requirement
      if (coupon.scopeType === 'FIRST_ORDER') {
        const priorOrdersCount = await prisma.order.count({
          where: {
            userProfileId,
            OR: [
              { paymentStatus: 'COMPLETED' },
              { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] } },
            ],
          },
        });

        if (priorOrdersCount > 0) {
          throw createError(400, `Coupon '${formattedCode}' is valid only on your 1st order`);
        }
      }
    }

    // Calculate qualifying subtotal based on scope
    let qualifyingSubtotal = 0;
    const matchingItemIds: string[] = [];

    if (coupon.scopeType === 'GENERAL' || coupon.scopeType === 'SEASONAL' || coupon.scopeType === 'FIRST_ORDER') {
      qualifyingSubtotal = subtotal;
    } else {
      for (const item of cartItems) {
        const p = item.product || {};
        const uPrice = item.variant ? item.variant.unitPrice : (p.unitPrice || 0);
        const discPct = item.variant ? (item.variant.discountPercentage || 0) : (p.discountPercentage || 0);
        const gst = item.variant ? (item.variant.gst || 18) : (p.gst || 18);
        const itemEffectivePrice = (uPrice * (1 - discPct / 100)) * (1 + gst / 100) * (item.quantity || 1);

        let matches = false;

        if (coupon.scopeType === 'PRODUCT') {
          if (coupon.applicableProductIds.includes(item.productId || p.id)) {
            matches = true;
          }
        } else if (coupon.scopeType === 'CATEGORY') {
          const catId = p.categoryId || p.category?.id;
          const subcatId = p.subcategoryId || p.subcategory?.id;
          if (
            (catId && coupon.applicableCategoryIds.includes(catId)) ||
            (subcatId && coupon.applicableCategoryIds.includes(subcatId))
          ) {
            matches = true;
          }
        } else if (coupon.scopeType === 'BRAND') {
          const bId = p.brandId || p.brand?.id;
          if (bId && coupon.applicableBrandIds.includes(bId)) {
            matches = true;
          }
        }

        if (matches) {
          qualifyingSubtotal += itemEffectivePrice;
          matchingItemIds.push(item.productId || p.id);
        }
      }

      if (qualifyingSubtotal <= 0) {
        const scopeNames: Record<string, string> = {
          PRODUCT: 'selected products',
          CATEGORY: 'selected categories',
          BRAND: 'selected brands',
        };
        throw createError(
          400,
          `Coupon '${formattedCode}' is only applicable to ${scopeNames[coupon.scopeType] || 'qualifying items'} in your cart`
        );
      }
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw createError(
        400,
        `Minimum cart value of ₹${coupon.minOrderAmount.toLocaleString('en-IN')} required to use this coupon (Current: ₹${Math.round(subtotal).toLocaleString('en-IN')})`
      );
    }

    // Calculate actual discount
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (qualifyingSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, qualifyingSubtotal);
    }

    discountAmount = Math.round(discountAmount);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minOrderAmount,
        scopeType: coupon.scopeType,
        badgeText: coupon.badgeText,
      },
      discountAmount,
      qualifyingSubtotal: Math.round(qualifyingSubtotal),
      finalTotal: Math.max(0, Math.round(subtotal - discountAmount)),
    };
  }
}
