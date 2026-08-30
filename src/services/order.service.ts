import { prisma } from '../config/prisma';
import { emitOrderStatusUpdate, emitNewOrderToAdmin } from '../config/socket';
import { ShippingService } from './shipping.service';
import { NotificationService } from './notification.service';
import { DbLoggerService } from './db-logger.service';
import { CouponService } from './coupon.service';
import { ReplenishmentService } from './replenishment.service';

const db = prisma as any;

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
      couponCode?: string;
    }
  ) {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
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

    // Validate coupon if provided
    let couponDiscount = 0;
    let couponId: string | null = null;
    let couponCodeFormatted: string | null = null;

    if (shippingInfo.couponCode && shippingInfo.couponCode.trim()) {
      const couponValidation = await CouponService.validateAndCalculateDiscount(
        shippingInfo.couponCode,
        userProfileId,
        cart.items,
        subTotalAmount
      );
      couponDiscount = couponValidation.discountAmount;
      couponId = couponValidation.coupon.id;
      couponCodeFormatted = couponValidation.coupon.code;
    }

    const { shippingAmount } = await ShippingService.calculateShipping(shippingInfo.shippingState, subTotalAmount);
    const totalAmount = Math.max(0, subTotalAmount - couponDiscount) + shippingAmount;

    const finalShippingPhone = (shippingInfo.shippingPhone && shippingInfo.shippingPhone.trim()) || userProfile?.phone || '';
    const finalShippingName = (shippingInfo.shippingName && shippingInfo.shippingName.trim()) || `${userProfile?.user?.firstName || ''} ${userProfile?.user?.lastName || ''}`.trim() || 'Customer';

    if (finalShippingPhone && !userProfile.phone) {
      await prisma.userProfile.update({
        where: { id: userProfileId },
        data: { phone: finalShippingPhone },
      }).catch(() => {});
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create order transactionally & deduct stock
    const order = await prisma.$transaction(async (tx) => {
      const txDb = tx as any;
      const newOrder = await txDb.order.create({
        data: {
          orderNumber,
          userProfileId,
          subTotalAmount,
          shippingAmount,
          totalAmount,
          couponCode: couponCodeFormatted,
          couponDiscount,
          couponId,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          shippingName: finalShippingName,
          shippingPhone: finalShippingPhone,
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

      // Deduct inventory using FEFO (First-Expiry-First-Out)
      for (const item of cart.items) {
        if (item.variantId) {
          const orderedVariant = await txDb.productVariant.findUnique({
            where: { id: item.variantId },
          });

          if (orderedVariant) {
            // Find all batches with the same flavor and weight ordered by earliest expiry first
            const matchingBatches = await txDb.productVariant.findMany({
              where: {
                productId: item.productId,
                flavor: orderedVariant.flavor,
                weight: orderedVariant.weight,
                stock: { gt: 0 },
              },
              orderBy: [
                { expiryDate: 'asc' },
                { createdAt: 'asc' },
              ],
            });

            let remainingToDeduct = item.quantity;

            if (matchingBatches.length > 0) {
              for (const batch of matchingBatches) {
                if (remainingToDeduct <= 0) break;
                const deductQty = Math.min(batch.stock, remainingToDeduct);
                await txDb.productVariant.update({
                  where: { id: batch.id },
                  data: { stock: { decrement: deductQty } },
                });
                remainingToDeduct -= deductQty;
              }
            } else {
              await txDb.productVariant.update({
                where: { id: orderedVariant.id },
                data: { stock: { decrement: item.quantity } },
              });
            }
          }
        }

        // Deduct parent product stock and recalculate earliest active expiry
        const updatedParent = await txDb.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
          },
          include: { variants: true },
        });

        const activeVariants = updatedParent.variants.filter((v: any) => v.stock > 0 && v.expiryDate);
        if (activeVariants.length > 0) {
          const earliest = new Date(Math.min(...activeVariants.map((v: any) => new Date(v.expiryDate).getTime())));
          await txDb.product.update({
            where: { id: item.productId },
            data: {
              expiryDate: earliest,
              status: updatedParent.stock <= 0 ? 'OUT_OF_STOCK' : updatedParent.status,
            },
          });
        } else if (updatedParent.stock <= 0) {
          await txDb.product.update({
            where: { id: item.productId },
            data: { status: 'OUT_OF_STOCK' },
          });
        }

        // Create inventory audit log
        await txDb.inventoryLog.create({
          data: {
            productId: item.productId,
            change: -item.quantity,
            type: 'ORDER_FULFILLMENT',
            reason: `Order #${newOrder.orderNumber} placed (FEFO inventory deduction)`,
          },
        }).catch(() => {});
      }

      // Record coupon usage and increment count
      if (couponId) {
        await txDb.couponUsage.create({
          data: {
            couponId,
            userProfileId,
            orderId: newOrder.id,
            discountAmount: couponDiscount,
          },
        });

        await txDb.coupon.update({
          where: { id: couponId },
          data: {
            usedCount: { increment: 1 },
          },
        });
      }

      return newOrder;
    });

    // Notify admin in real time
    emitNewOrderToAdmin(order);
    try {
      await NotificationService.notifyAdmins(
        'New Order Received! 🛍️',
        `Order #${order.orderNumber} for ₹${Number(order.totalAmount).toFixed(2)} was placed by ${order.shippingName}.`,
        `/orders/${order.id}`,
        'ORDER_UPDATE'
      );
    } catch {}

    // Notify customer
    try {
      await NotificationService.sendToUser(
        order.userProfileId,
        'Order Placed Successfully! 🛍️',
        `Thank you! Your order #${order.orderNumber} for ₹${Number(order.totalAmount).toFixed(2)} has been placed.`,
        'ORDER_UPDATE',
        '/orders'
      );
    } catch {}

    // Log to Journal
    DbLoggerService.logOrder('ORDER_CREATED', order.id, {
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      shippingAmount: order.shippingAmount,
      couponDiscount: order.couponDiscount,
      couponCode: order.couponCode,
      shippingName: order.shippingName,
      paymentMethod: order.paymentMethod,
    });

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

    // Handle stock restoration if a paid/confirmed order gets cancelled
    if (newStatus === 'CANCELLED' && previousStatus !== 'CANCELLED' && existingOrder.paymentStatus === 'COMPLETED') {
      await prisma.$transaction(async (tx) => {
        for (const item of existingOrder.items) {
          if (item.productId) {
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

          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: { increment: item.quantity },
              },
            });
          }
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

    // Send push & in-app notification to the user
    try {
      await NotificationService.sendToUser(
        updatedOrder.userProfileId,
        'Order Updated',
        `Your order #${updatedOrder.orderNumber} status is now ${newStatus}.`,
        'ORDER_UPDATE',
        `/orders`
      );
    } catch (err) {
      console.error('Failed to send order status update notification:', err);
    }

    // Log to Journal
    DbLoggerService.logOrder(newStatus === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED', updatedOrder.id, {
      orderNumber: updatedOrder.orderNumber,
      previousStatus: existingOrder.status,
      newStatus,
      trackingNumber,
      comment,
    });
    
    // AI Predictive Replenishment
    if (newStatus === 'DELIVERED' && previousStatus !== 'DELIVERED') {
      // Async so it doesn't block the request
      ReplenishmentService.generateSchedulesForOrder(updatedOrder.id).catch((err) => {
        console.error('[AI] Failed to generate replenishment schedules:', err);
      });
    }

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

  static async getAdminOrders(
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { shippingName: { contains: q, mode: 'insensitive' } },
        { shippingPhone: { contains: q, mode: 'insensitive' } },
        { shippingAddress: { contains: q, mode: 'insensitive' } },
        { couponCode: { contains: q, mode: 'insensitive' } },
        {
          userProfile: {
            OR: [
              { phone: { contains: q, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
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

    orders.forEach((o: any) => {
      if (o.userProfile && !o.userProfile.phone && o.shippingPhone) {
        o.userProfile.phone = o.shippingPhone;
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

    if (order.userProfile && !order.userProfile.phone && order.shippingPhone) {
      order.userProfile.phone = order.shippingPhone;
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
