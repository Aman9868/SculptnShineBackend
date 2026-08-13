import { prisma } from '../config/prisma';
import { emitOrderStatusUpdate, emitNewOrderToAdmin } from '../config/socket';
import { ShippingService } from './shipping.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class OrderService {
  static async createOrderFromCart(
    userId: string,
    shippingInfo: {
      shippingName: string;
      shippingPhone: string;
      shippingAddress: string;
      shippingCity: string;
      shippingState: string;
      shippingPincode: string;
      notes?: string;
    }
  ) {
    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!userProfile) throw createError(404, 'User profile not found');
    const userProfileId = userProfile.id;

    const cart = await prisma.cart.findUnique({
      where: { userProfileId },
      include: {
        items: {
          include: { product: true, variant: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw createError(400, 'Your cart is empty');
    }

    // Validate stock for all items
    for (const item of cart.items) {
      const stockAvailable = item.variant ? item.variant.stock : item.product.stock;
      if (item.product.status !== 'ACTIVE' || stockAvailable < item.quantity) {
        throw createError(
          400,
          `Item '${item.product.title}' has insufficient stock (Requested: ${item.quantity}, Available: ${stockAvailable})`
        );
      }
    }

    // Calculate subTotalAmount
    const subTotalAmount = cart.items.reduce((sum, item) => {
      const uPrice = item.variant ? item.variant.unitPrice : item.product.unitPrice;
      const discPct = item.variant ? (item.variant.discountPercentage || 0) : (item.product.discountPercentage || 0);
      const gst = item.variant ? item.variant.gst : item.product.gst;
      const discountedPrice = uPrice - (uPrice * (discPct / 100));
      const finalPrice = discountedPrice + (discountedPrice * (gst / 100));
      return sum + finalPrice * item.quantity;
    }, 0);

    const { shippingAmount } = await ShippingService.calculateShipping(shippingInfo.shippingState, subTotalAmount);
    const totalAmount = subTotalAmount + shippingAmount;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create order transactionally & deduct stock
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userProfileId,
          subTotalAmount,
          shippingAmount,
          totalAmount,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          shippingName: shippingInfo.shippingName,
          shippingPhone: shippingInfo.shippingPhone,
          shippingAddress: shippingInfo.shippingAddress,
          shippingCity: shippingInfo.shippingCity,
          shippingState: shippingInfo.shippingState,
          shippingPincode: shippingInfo.shippingPincode,
          notes: shippingInfo.notes,
          items: {
            create: cart.items.map((item) => {
              const uPrice = item.variant ? item.variant.unitPrice : item.product.unitPrice;
              const discPct = item.variant ? (item.variant.discountPercentage || 0) : (item.product.discountPercentage || 0);
              const gst = item.variant ? item.variant.gst : item.product.gst;
              const title = item.variant ? item.variant.title : item.product.title;
              const sku = item.variant ? item.variant.sku : item.product.sku;

              return {
                productId: item.productId,
                variantId: item.variantId,
                productName: title,
                productSku: sku,
                unitPrice: uPrice,
                discountPercentage: discPct,
                gst: gst,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: {
          items: { include: { product: true } },
          userProfile: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        },
      });

      // Deduct stock & write InventoryLogs
      for (const item of cart.items) {
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updatedProduct.stock <= 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { status: 'OUT_OF_STOCK' },
          });
        }

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            change: -item.quantity,
            type: 'ORDER_RESERVATION',
            reason: `Stock reserved for Order #${orderNumber}`,
          },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    // Notify admin in real time
    emitNewOrderToAdmin(order);

    return order;
  }

  static async updateOrderStatus(orderId: string, newStatus: any, trackingNumber?: string, comment?: string) {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder) {
      throw createError(404, 'Order not found');
    }

    const previousStatus = existingOrder.status;

    // Handle stock restoration if order gets cancelled
    if (newStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') {
      await prisma.$transaction(async (tx) => {
        for (const item of existingOrder.items) {
          if (!item.productId) continue;
          
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              status: 'ACTIVE',
            },
          });

          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              change: item.quantity,
              type: 'ORDER_CANCELLED_RESTOCK',
              reason: `Restock due to order cancellation: ${existingOrder.orderNumber}`,
            },
          });
        }
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        trackingNumber: trackingNumber !== undefined ? trackingNumber : existingOrder.trackingNumber,
        statusHistory: {
          create: {
            status: newStatus,
            comment: comment || null,
          }
        }
      },
      include: {
        items: { include: { product: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        userProfile: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      },
    });

    // Broadcast status change in real time via Socket.IO
    emitOrderStatusUpdate(orderId, {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.paymentStatus,
      trackingNumber: updatedOrder.trackingNumber,
      updatedAt: updatedOrder.updatedAt,
      history: updatedOrder.statusHistory,
    });

    return updatedOrder;
  }

  static async getUserOrders(userId: string, page = 1, limit = 10, status?: string) {
    const skip = (page - 1) * limit;
    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    const where: any = { userProfileId: userProfile?.id || 'not-found' };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { select: { id: true, title: true, images: true } } } },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async trackOrder(orderNumber: string, emailOrPhone: string) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        userProfile: { include: { user: { select: { email: true } } } },
        items: { include: { product: { select: { title: true, images: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      }
    });

    if (!order) {
      throw createError(404, 'Order not found with that Order ID.');
    }

    const customerEmail = order.userProfile?.user?.email?.toLowerCase() || '';
    const customerPhone = order.userProfile?.phone || '';
    const shippingPhone = order.shippingPhone || '';
    const input = emailOrPhone.toLowerCase().trim();

    if (input !== customerEmail && input !== customerPhone && input !== shippingPhone) {
      throw createError(403, 'The Email or Phone number does not match our records for this order.');
    }

    // Return safe data without exposing sensitive info like full address or payment IDs
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      subTotalAmount: order.subTotalAmount,
      shippingAmount: order.shippingAmount,
      totalAmount: order.totalAmount,
      trackingNumber: order.trackingNumber,
      shippingName: order.shippingName,
      statusHistory: order.statusHistory,
      items: order.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        image: item.product?.images?.[0] || null
      }))
    };
  }

  static async getAdminOrders(page = 1, limit = 10, status?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { shippingName: { contains: search, mode: 'insensitive' } },
        { shippingPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total, kpiData] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userProfile: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
          items: { include: { product: { select: { id: true, title: true, images: true } } } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const kpis = {
      totalOrders: 0,
      deliveredOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
    };

    kpiData.forEach(item => {
      const count = item._count.id;
      kpis.totalOrders += count;
      
      if (item.status === 'DELIVERED') kpis.deliveredOrders += count;
      if (['PENDING_PAYMENT', 'PAID', 'PROCESSING'].includes(item.status)) kpis.processingOrders += count;
      if (['SHIPPED', 'OUT_FOR_DELIVERY'].includes(item.status)) kpis.shippedOrders += count;
      if (item.status === 'CANCELLED') kpis.cancelledOrders += count;
      
      if (item.status !== 'CANCELLED') {
        kpis.totalRevenue += Number(item._sum.totalAmount || 0);
      }
    });

    return {
      kpis,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getOrderById(orderId: string, requestingUserId?: string, isAdmin = false) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        userProfile: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        items: { include: { product: true, variant: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }

    if (!isAdmin && requestingUserId && order.userProfile?.user?.id !== requestingUserId) {
      throw createError(403, 'Unauthorized access to this order');
    }

    return order;
  }

  static async cancelOrder(userId: string, orderId: string, reason?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw createError(404, 'Order not found');
    }

    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    if (order.userProfileId !== userProfile?.id) {
      throw createError(403, 'Unauthorized access');
    }

    if (order.status === 'DELIVERED' || order.status === 'SHIPPED' || order.status === 'CANCELLED') {
      throw createError(400, `Cannot cancel order in '${order.status}' state`);
    }

    return this.updateOrderStatus(orderId, 'CANCELLED');
  }
}
