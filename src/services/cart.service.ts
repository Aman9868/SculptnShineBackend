import { prisma } from '../config/prisma';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserProfileId = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user || !user.profile) throw createError(404, 'User profile not found');
  return user.profile.id;
};

export class CartService {
  static async getCart(userId: string) {
    const userProfileId = await getUserProfileId(userId);

    let cart = await prisma.cart.findUnique({
      where: { userProfileId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                unitPrice: true,
                discountPercentage: true,
                gst: true,
                stock: true,
                images: true,
                status: true,
              },
            },
            variant: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userProfileId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  unitPrice: true,
                  discountPercentage: true,
                  gst: true,
                  stock: true,
                  images: true,
                  status: true,
                },
              },
              variant: true,
            },
          },
        },
      });
    }

    // Calculate aggregated prices
    let subtotal = 0;
    let itemCount = 0;

    const formattedItems = cart.items.map((item) => {
      const uPrice = item.variant ? item.variant.unitPrice : item.product.unitPrice;
      const discPct = item.variant ? (item.variant.discountPercentage || 0) : (item.product.discountPercentage || 0);
      const gst = item.variant ? item.variant.gst : item.product.gst;
      
      const discountedPrice = uPrice - (uPrice * (discPct / 100));
      const finalPrice = discountedPrice + (discountedPrice * (gst / 100));
      
      const itemSubtotal = finalPrice * item.quantity;
      subtotal += itemSubtotal;
      itemCount += item.quantity;
      
      const stockAvailable = item.variant ? item.variant.stock : item.product.stock;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        product: item.product,
        variant: item.variant,
        unitPrice: uPrice,
        subtotal: itemSubtotal,
        isAvailable: stockAvailable >= item.quantity && item.product.status === 'ACTIVE',
      };
    });

    return {
      cartId: cart.id,
      userProfileId: cart.userProfileId,
      items: formattedItems,
      itemCount,
      subtotal,
      updatedAt: cart.updatedAt,
    };
  }

  static async addToCart(userId: string, productId: string, variantId?: string, quantity = 1) {
    if (quantity <= 0) {
      throw createError(400, 'Quantity must be at least 1');
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw createError(404, 'Product not found');
    }

    if (product.status !== 'ACTIVE') {
      throw createError(400, `Product is currently unavailable`);
    }

    let stockToCheck = product.stock;
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      if (!variant) throw createError(404, 'Variant not found');
      stockToCheck = variant.stock;
    }

    if (stockToCheck < quantity) {
      throw createError(400, `Insufficient product stock available (${stockToCheck} left)`);
    }

    const userProfileId = await getUserProfileId(userId);
    let cart = await prisma.cart.findUnique({ where: { userProfileId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userProfileId } });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: { 
        cartId: cart.id, 
        productId,
        variantId: variantId || null 
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (stockToCheck < newQuantity) {
        throw createError(400, `Cannot add more items. Stock limit is ${stockToCheck}`);
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  static async updateCartItem(userId: string, cartItemId: string, quantity: number) {
    const userProfileId = await getUserProfileId(userId);
    const cart = await prisma.cart.findUnique({ where: { userProfileId } });
    if (!cart) {
      throw createError(404, 'Cart not found');
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
      include: { product: true, variant: true },
    });

    if (!item) {
      throw createError(404, 'Item not found in your cart');
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: cartItemId } });
    } else {
      const stockToCheck = item.variant ? item.variant.stock : item.product.stock;
      if (stockToCheck < quantity) {
        throw createError(400, `Requested quantity exceeds available stock (${stockToCheck} left)`);
      }

      await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity },
      });
    }

    return this.getCart(userId);
  }

  static async removeFromCart(userId: string, cartItemId: string) {
    const userProfileId = await getUserProfileId(userId);
    const cart = await prisma.cart.findUnique({ where: { userProfileId } });
    if (!cart) {
      throw createError(404, 'Cart not found');
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
    });

    if (!item) {
      throw createError(404, 'Item not found in your cart');
    }

    await prisma.cartItem.delete({ where: { id: cartItemId } });
    return this.getCart(userId);
  }

  static async clearCart(userId: string) {
    const userProfileId = await getUserProfileId(userId);
    const cart = await prisma.cart.findUnique({ where: { userProfileId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { message: 'Cart cleared successfully' };
  }
}
