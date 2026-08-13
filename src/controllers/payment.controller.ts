import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';

export class PaymentController {
  static async initiatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { orderId } = req.params;
      const result = await PaymentService.initiatePayment(orderId as string, userId);
      res.status(200).json({
        success: true,
        message: 'Payment session initiated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.method === 'POST' ? req.body : req.query;
      const result = await PaymentService.handlePhonePeCallback(payload, req.headers);
      
      // If frontend HTML redirect requested
      if (req.method === 'GET' || req.query.merchantTransactionId) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?status=${result.success ? 'success' : 'failed'}&order_id=${result.orderId}`);
      }

      res.status(200).json({
        success: result.success,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { merchantTransactionId } = req.params;
      const result = await PaymentService.verifyStatus(merchantTransactionId as string);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
