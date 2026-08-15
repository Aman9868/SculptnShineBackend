import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

export class WishlistService {
  /**
   * Toggles a product in the user's wishlist
   * @param userProfileId 
   * @param productId 
   * @returns { isAdded: boolean, message: string }
   */
  static async toggleWishlist(userProfileId: string, productId: string) {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw { statusCode: 404, message: 'Product not found' } as AppError;
    }

    // Check if it already exists in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        userProfileId_productId: {
          userProfileId,
          productId,
        },
      },
    });

    if (existingItem) {
      // Remove from wishlist
      await prisma.wishlistItem.delete({
        where: { id: existingItem.id },
      });
      return { isAdded: false, message: 'Product removed from wishlist' };
    } else {
      // Add to wishlist
      await prisma.wishlistItem.create({
        data: {
          userProfileId,
          productId,
        },
      });
      return { isAdded: true, message: 'Product added to wishlist' };
    }
  }

  /**
   * Retrieves paginated wishlist for a user profile
   * @param userProfileId 
   * @param page 
   * @param limit 
   * @returns { data, total, page, limit, totalPages }
   */
  static async getWishlist(userProfileId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.wishlistItem.count({
        where: { userProfileId },
      }),
      prisma.wishlistItem.findMany({
        where: { userProfileId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              variants: {
                orderBy: { isDefault: 'desc' },
                take: 1
              }
            }
          }
        },
      }),
    ]);

    // Format the items to a flatter structure suitable for frontend
    const formattedItems = items.map((item: any) => {
      const defaultVariant = item.product.variants?.[0];
      const unitPrice = defaultVariant ? defaultVariant.unitPrice : item.product.unitPrice;
      const discountPercentage = defaultVariant ? (defaultVariant.discountPercentage || 0) : (item.product.discountPercentage || 0);
      const stock = defaultVariant ? defaultVariant.stock : item.product.stock;
      const thumbnail = (defaultVariant?.images && defaultVariant.images.length > 0 ? defaultVariant.images[0] : null) ||
        (item.product.images && item.product.images.length > 0 ? item.product.images[0] : null);

      return {
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        product: {
          id: item.product.id,
          name: item.product.title,
          title: item.product.title,
          slug: item.product.slug,
          thumbnail,
          unitPrice: unitPrice || 0,
          price: unitPrice || 0,
          discountPercentage,
          discountPrice: discountPercentage > 0 ? unitPrice * (1 - discountPercentage / 100) : null,
          status: item.product.status,
          stock: stock ?? 0
        }
      };
    });

    return {
      data: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
