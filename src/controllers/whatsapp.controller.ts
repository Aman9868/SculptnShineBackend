import { Request, Response, NextFunction } from 'express';
import { WhatsAppSessionService } from '../services/whatsapp-session.service';

export class WhatsAppController {
  /**
   * Get current WhatsApp connection status and active QR code (if scanning)
   */
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = WhatsAppSessionService.getStatus();
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Explicitly request a fresh QR code
   */
  static async getQR(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await WhatsAppSessionService.requestQR();
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnects / unlinks current WhatsApp session
   */
  static async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WhatsAppSessionService.disconnect();
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle automated customer notifications on or off
   */
  static async toggleAutomation(req: Request, res: Response, next: NextFunction) {
    try {
      const { enabled } = req.body;
      const result = WhatsAppSessionService.toggleAutomation(Boolean(enabled));
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sends a test message to a specified phone number
   */
  static async sendTestMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, message } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required',
        });
      }

      const result = await WhatsAppSessionService.sendTestMessage(phone, message);
      return res.status(200).json({
        success: true,
        message: 'Test WhatsApp message sent successfully',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to send WhatsApp test message',
      });
    }
  }

  /**
   * Sends a quotation link to a specified phone number
   */
  static async sendQuotation(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, fileUrl } = req.body;

      if (!phone || !fileUrl) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and file URL are required',
        });
      }

      const message = `*SculptnShine B2B Quotation* 📄\n\nHere is the quotation you requested. You can download it directly here:\n${fileUrl}\n\nPlease let us know if you have any questions!`;
      
      const result = await WhatsAppSessionService.sendMessage(phone, message);
      return res.status(200).json({
        success: true,
        message: 'WhatsApp quotation sent successfully',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to send WhatsApp quotation',
      });
    }
  }
}
