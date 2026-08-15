import { Request, Response, NextFunction } from 'express';
import { EmailConfigService } from '../services/email-config.service';

export class EmailConfigController {
  static async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await EmailConfigService.getConfig();
      // Omit password from response
      const { password, ...safeConfig } = config;

      res.status(200).json({
        success: true,
        message: 'Email configuration fetched successfully',
        data: safeConfig,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { host, port, secure, user, password, fromName, fromEmail, isEnabled } = req.body;

      if (!host || !port || !user) {
        return res.status(400).json({ success: false, message: 'Host, Port, and User are required' });
      }

      const config = await EmailConfigService.upsertConfig({
        host,
        port: Number(port),
        secure: Boolean(secure),
        user,
        password,
        fromName,
        fromEmail,
        isEnabled: Boolean(isEnabled),
      });

      const { password: _, ...safeConfig } = config;

      res.status(200).json({
        success: true,
        message: 'Email configuration updated successfully',
        data: safeConfig,
      });
    } catch (error) {
      next(error);
    }
  }

  static async testConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const { host, port, secure, user, password } = req.body;

      if (!host || !port || !user) {
        return res.status(400).json({ success: false, message: 'Host, Port, and User are required to test connection' });
      }

      const result = await EmailConfigService.testConnection({
        host,
        port: Number(port),
        secure: Boolean(secure),
        user,
        password,
      });

      if (result.success) {
        res.status(200).json({ success: true, message: result.message });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      next(error);
    }
  }

  static async sendTestEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Recipient email address is required' });
      }

      const { NotificationChannelService } = await import('../services/notification-channel.service');
      
      const result = await NotificationChannelService.sendEmail(email, {
        title: 'Test Email Configuration',
        message: 'Your Sculpt & Shine Email Engine is successfully configured and working! Automated notifications will be sent to your customers.',
      });

      if (result.sent) {
        res.status(200).json({ success: true, message: 'Test email sent successfully!' });
      } else {
        res.status(400).json({ success: false, message: `Failed to send email: ${result.reason}` });
      }
    } catch (error) {
      next(error);
    }
  }
}
