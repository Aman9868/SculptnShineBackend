import { prisma } from '../config/prisma';
import { phonepeConfig, phonepeClient } from '../config/phonepe.config';
import { OrderService } from './order.service';
import { emitOrderStatusUpdate } from '../config/socket';
import { InvoiceService } from './invoice.service';
import { NotificationService } from './notification.service';
import { DbLoggerService } from './db-logger.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class PaymentService {
  static async initiatePayment(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { userProfile: { include: { user: true } } },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }

    if (order.userProfile?.user?.id !== userId) {
      throw createError(403, 'Unauthorized access to this order');
    }

    if (order.paymentStatus === 'COMPLETED' || order.status === 'PAID') {
      throw createError(400, 'Order is already paid');
    }

    const merchantTransactionId = `MTXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        merchantTransactionId,
        provider: 'PHONEPE',
        amount: order.totalAmount,
        status: 'PENDING',
      },
    });

    DbLoggerService.logPayment('PAYMENT_INITIATED', order.id, payment.id, {
      amount: order.totalAmount,
      merchantTransactionId,
      provider: 'PHONEPE',
      orderNumber: order.orderNumber,
    });

    try {
      const paymentResult = await phonepeClient.createPaymentOrder({
        merchantTransactionId,
        amount: order.totalAmount,
        userId,
        orderId: order.id,
        mobileNumber: order.shippingPhone || order.userProfile?.phone || undefined,
      });

      if (paymentResult.rawResponse) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { responsePayload: paymentResult.rawResponse },
        });
      }

      return {
        isTestMode: paymentResult.isTestMode,
        merchantTransactionId,
        paymentUrl: paymentResult.paymentUrl,
        message: paymentResult.isTestMode
          ? 'Test mode enabled. Redirecting to simulated payment completion.'
          : 'Redirecting to PhonePe gateway.',
      };
    } catch (err: any) {
      console.error('Payment Initiation Error:', err);
      throw createError(500, err.message || 'Failed to initiate payment');
    }
  }

  static async handlePhonePeCallback(body: any, headers?: any) {
    console.log('💳 PhonePe Callback Received:', body);

    let merchantTransactionId =
      body.merchantTransactionId ||
      body.data?.merchantTransactionId ||
      body.merchantOrderId ||
      body.data?.merchantOrderId;

    let isSuccess =
      body.code === 'PAYMENT_SUCCESS' ||
      body.success === true ||
      body.data?.code === 'PAYMENT_SUCCESS' ||
      body.data?.state === 'COMPLETED' ||
      body.state === 'COMPLETED';

    if (!merchantTransactionId) {
      throw createError(400, 'Invalid callback payload: missing merchantTransactionId');
    }

    const payment = await prisma.payment.findUnique({
      where: { merchantTransactionId },
      include: {
        order: {
          include: {
            items: true,
            userProfile: {
              include: {
                user: {
                  select: { id: true, email: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw createError(404, 'Payment record not found');
    }

    if (isSuccess) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            gatewayTransactionId: body.transactionId || body.data?.transactionId || `GW_${Date.now()}`,
            responsePayload: body,
          },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'COMPLETED',
          },
        });

        // Deduct stock for all ordered products & variants upon payment confirmation
        for (const item of payment.order.items) {
          if (item.productId) {
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
                reason: `Stock deducted for paid Order #${payment.order.orderNumber}`,
              },
            });
          }

          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: { decrement: item.quantity },
              },
            });
          }
        }
      });

      emitOrderStatusUpdate(payment.orderId, {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        updatedAt: new Date(),
      });

      // Notify admin of completed payment
      try {
        await NotificationService.notifyAdmins(
          'Payment Completed! 💳',
          `Order #${payment.order.orderNumber} (₹${payment.order.totalAmount}) is PAID.`,
          `/orders/${payment.orderId}`,
          'ORDER_UPDATE'
        );
      } catch {}

      // Notify customer of payment confirmation
      try {
        await NotificationService.sendToUser(
          payment.order.userProfileId,
          'Payment Successful! 💳',
          `Payment for your Order #${payment.order.orderNumber} (₹${payment.order.totalAmount}) was successful!`,
          'ORDER_UPDATE',
          `/orders/${payment.orderId}`
        );
      } catch {}

      // Clear user cart items upon successful payment confirmation
      try {
        const userCart = await prisma.cart.findUnique({
          where: { userProfileId: payment.order.userProfileId },
        });
        if (userCart) {
          await prisma.cartItem.deleteMany({
            where: { cartId: userCart.id },
          });
        }
      } catch (cartErr) {
        console.error('Failed to clear cart after payment:', cartErr);
      }

      const actorUser = payment.order?.userProfile?.user;
      const customerFullName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}`.trim() : payment.order?.shippingName;
      const customerEmail = actorUser?.email || payment.order?.userProfile?.user?.email;

      // Log to Journal
      DbLoggerService.logPayment(
        'PAYMENT_SUCCESS',
        payment.orderId,
        payment.id,
        {
          orderNumber: payment.order.orderNumber,
          amount: payment.amount,
          merchantTransactionId,
          gatewayTransactionId: body.transactionId || body.data?.transactionId,
          customerName: customerFullName,
          userEmail: customerEmail,
          shippingName: payment.order.shippingName,
        },
        'SUCCESS',
        {
          userId: actorUser?.id,
          userEmail: customerEmail,
        }
      );

      return { success: true, message: 'Payment completed successfully', orderId: payment.orderId };
    } else {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            responsePayload: body,
          },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'PAYMENT_FAILED',
            paymentStatus: 'FAILED',
          },
        }),
      ]);

      const actorUser = payment.order?.userProfile?.user;
      const customerFullName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}`.trim() : payment.order?.shippingName;
      const customerEmail = actorUser?.email || payment.order?.userProfile?.user?.email;

      // Log failure to Journal
      DbLoggerService.logPayment(
        'PAYMENT_FAILED',
        payment.orderId,
        payment.id,
        {
          orderNumber: payment.order.orderNumber,
          amount: payment.amount,
          merchantTransactionId,
          response: body,
          customerName: customerFullName,
          userEmail: customerEmail,
          shippingName: payment.order.shippingName,
        },
        'FAILED',
        {
          userId: actorUser?.id,
          userEmail: customerEmail,
        }
      );

      // Restore stock on failed payment
      await OrderService.updateOrderStatus(payment.orderId, 'CANCELLED');

      return { success: false, message: 'Payment failed', orderId: payment.orderId };
    }
  }

  static async verifyStatus(merchantTransactionId: string) {
    const payment = await prisma.payment.findUnique({
      where: { merchantTransactionId },
      include: { order: true },
    });

    if (!payment) {
      throw createError(404, 'Payment transaction not found');
    }

    const statusResult = await phonepeClient.checkTransactionStatus(merchantTransactionId);
    return statusResult;
  }
}
