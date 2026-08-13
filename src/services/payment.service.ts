import { prisma } from '../config/prisma';
import {
  phonepeConfig,
  createPhonePePayload,
  generatePhonePeChecksum,
  generatePhonePeStatusChecksum,
  verifyPhonePeChecksum,
} from '../config/phonepe.config';
import { OrderService } from './order.service';
import { emitOrderStatusUpdate } from '../config/socket';
import { InvoiceService } from './invoice.service';

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

    // Check if PAYMENT_TEST_MODE is enabled (just like in ridewithdriver)
    if (phonepeConfig.isTestMode) {
      console.log(`🧪 [Payment] PAYMENT_TEST_MODE is true. Simulating PhonePe transaction for ${merchantTransactionId}`);
      
      const simulatedRedirectUrl = `${phonepeConfig.callbackUrl}?merchantTransactionId=${merchantTransactionId}&code=PAYMENT_SUCCESS&transactionId=SIMULATED_${Date.now()}`;
      
      return {
        isTestMode: true,
        merchantTransactionId,
        paymentUrl: simulatedRedirectUrl,
        message: 'Test mode enabled. Redirecting to simulated payment completion handler.',
      };
    }

    // Production / UAT Live API Call
    const redirectUrl = `${phonepeConfig.frontendUrl}/orders/${order.id}?txn=${merchantTransactionId}`;
    const { base64Payload } = createPhonePePayload({
      merchantTransactionId,
      userId,
      amount: order.totalAmount,
      mobileNumber: order.shippingPhone || order.userProfile?.phone || undefined,
      redirectUrl,
    });

    const xVerifyHeader = generatePhonePeChecksum(base64Payload, '/pg/v1/pay');

    try {
      const response = await fetch(`${phonepeConfig.hostUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerifyHeader,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const responseData: any = await response.json();

      await prisma.payment.update({
        where: { id: payment.id },
        data: { responsePayload: responseData },
      });

      if (responseData.success && responseData.data?.instrumentResponse?.redirectInfo?.url) {
        return {
          isTestMode: false,
          merchantTransactionId,
          paymentUrl: responseData.data.instrumentResponse.redirectInfo.url,
        };
      } else {
        throw createError(400, responseData.message || 'Payment initiation failed at gateway');
      }
    } catch (err: any) {
      console.error('PhonePe API Error:', err);
      throw createError(500, err.message || 'Payment gateway connection error');
    }
  }

  static async handlePhonePeCallback(body: any, headers?: any) {
    console.log('💳 PhonePe Callback Received:', body);

    let merchantTransactionId = body.merchantTransactionId || body.data?.merchantTransactionId;
    let isSuccess = body.code === 'PAYMENT_SUCCESS' || body.success === true || body.data?.code === 'PAYMENT_SUCCESS';

    if (!merchantTransactionId) {
      throw createError(400, 'Invalid callback payload: missing merchantTransactionId');
    }

    const payment = await prisma.payment.findUnique({
      where: { merchantTransactionId },
      include: { order: true },
    });

    if (!payment) {
      throw createError(404, 'Payment record not found');
    }

    // Verify response signature if not test mode
    if (!phonepeConfig.isTestMode && headers && headers['x-verify']) {
      const isValid = verifyPhonePeChecksum(body.response || '', headers['x-verify']);
      if (!isValid) {
        console.warn('⚠️ Warning: PhonePe Callback checksum verification failed');
      }
    }

    if (isSuccess) {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            gatewayTransactionId: body.transactionId || body.data?.transactionId || `GW_${Date.now()}`,
            responsePayload: body,
          },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'COMPLETED',
          },
        }),
      ]);

      emitOrderStatusUpdate(payment.orderId, {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        updatedAt: new Date(),
      });

      // Generate and send invoice asynchronously
      InvoiceService.generateInvoice(payment.orderId)
        .then(() => InvoiceService.sendInvoiceEmail(payment.orderId))
        .catch((err) => console.error('[Invoice] Failed to generate/send invoice:', err));

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

    if (phonepeConfig.isTestMode) {
      return {
        merchantTransactionId,
        status: payment.status,
        orderStatus: payment.order.status,
        amount: payment.amount,
        isTestMode: true,
      };
    }

    const xVerifyHeader = generatePhonePeStatusChecksum(merchantTransactionId);
    const url = `${phonepeConfig.hostUrl}/pg/v1/status/${phonepeConfig.merchantId}/${merchantTransactionId}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerifyHeader,
          'X-MERCHANT-ID': phonepeConfig.merchantId,
        },
      });

      const responseData: any = await res.json();
      return responseData;
    } catch (err: any) {
      throw createError(500, 'Error verifying status from PhonePe gateway');
    }
  }
}
