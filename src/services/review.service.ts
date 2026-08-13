import { PrismaClient, ReviewStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function updateProductRatingStats(productId: string) {
  const reviews = await prisma.productReview.findMany({
    where: { 
      productId,
      status: 'APPROVED'
    },
    select: { rating: true }
  });

  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
    : 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      reviewCount,
      averageRating: parseFloat(averageRating.toFixed(1))
    }
  });
}

export const reviewService = {
  addReview: async (data: {
    productId: string;
    userProfileId?: string;
    rating: number;
    title?: string;
    comment?: string;
    images?: string[];
    isVerifiedPurchase?: boolean;
    isAdminCreated?: boolean;
  }) => {
    // If admin is creating the review, auto-approve it.
    // Otherwise, you could default to PENDING for moderation, but let's default to APPROVED for now based on typical small e-commerce setups unless strict moderation is requested.
    const status: ReviewStatus = data.isAdminCreated ? 'APPROVED' : 'APPROVED';

    const review = await prisma.productReview.create({
      data: {
        productId: data.productId,
        userProfileId: data.userProfileId || null,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        images: data.images || [],
        isVerifiedPurchase: data.isVerifiedPurchase || false,
        status
      }
    });

    if (status === 'APPROVED') {
      await updateProductRatingStats(data.productId);
    }

    return review;
  },

  getProductReviews: async (productId: string, filters?: { status?: ReviewStatus, limit?: number }) => {
    let whereClause: any = { productId };
    if (filters?.status) {
      whereClause.status = filters.status;
    } else {
      // By default, only show approved reviews to public
      whereClause.status = 'APPROVED';
    }

    return prisma.productReview.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
      include: {
        userProfile: {
          select: {
            user: { select: { firstName: true, lastName: true } },
            profileImage: true
          }
        }
      }
    });
  },

  getAllReviewsAdmin: async (filters?: { status?: ReviewStatus, search?: string }) => {
    let whereClause: any = {};
    if (filters?.status) whereClause.status = filters.status;
    if (filters?.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { comment: { contains: filters.search, mode: 'insensitive' } },
        { product: { title: { contains: filters.search, mode: 'insensitive' } } }
      ];
    }

    return prisma.productReview.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, title: true, images: true, slug: true } },
        userProfile: {
          select: { user: { select: { firstName: true, lastName: true, email: true } } }
        }
      }
    });
  },

  updateReviewStatus: async (id: string, status: ReviewStatus) => {
    const review = await prisma.productReview.update({
      where: { id },
      data: { status }
    });

    // We must update the product stats because the review status changed (could be approved or rejected now)
    await updateProductRatingStats(review.productId);

    return review;
  },

  deleteReview: async (id: string) => {
    const review = await prisma.productReview.delete({
      where: { id }
    });

    await updateProductRatingStats(review.productId);
    return review;
  },

  updateReview: async (id: string, data: { rating?: number; title?: string; comment?: string }) => {
    const review = await prisma.productReview.update({
      where: { id },
      data: {
        rating: data.rating,
        title: data.title,
        comment: data.comment
      }
    });

    // We must update the product stats because the rating may have changed
    await updateProductRatingStats(review.productId);

    return review;
  },

  checkEligibility: async (productId: string, userProfileId: string) => {
    const order = await prisma.order.findFirst({
      where: {
        userProfileId,
        status: 'DELIVERED',
        items: {
          some: { productId }
        }
      }
    });
    return !!order;
  }
};
