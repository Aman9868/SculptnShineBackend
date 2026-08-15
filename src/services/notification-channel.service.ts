import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

type NotificationPayload = {
  title: string;
  message: string;
  link?: string | null;
};

const getActionUrl = (link?: string | null) => {
  if (!link) return process.env.FRONTEND_URL || '';
  if (/^https?:\/\//i.test(link)) return link;

  const baseUrl = process.env.FRONTEND_URL || '';
  if (!baseUrl) return link;

  return `${baseUrl.replace(/\/$/, '')}/${link.replace(/^\//, '')}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

import { EmailConfigService } from './email-config.service';

export class NotificationChannelService {
  static async sendEmail(to: string, payload: NotificationPayload) {
    const config = await EmailConfigService.getConfig();

    if (!config || !config.isEnabled) {
      console.warn('[NotificationChannelService] Email Engine is disabled or not configured. Email skipped.');
      return { sent: false, skipped: true, reason: 'EMAIL_ENGINE_DISABLED' };
    }

    if (!config.host || !config.user || !config.password) {
      console.warn('[NotificationChannelService] Email credentials missing. Email skipped.');
      return { sent: false, skipped: true, reason: 'CREDENTIALS_MISSING' };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    const fromName = config.fromName || 'Sculpt N Shine';
    const fromEmail = config.fromEmail || config.user;
    const from = `"${fromName}" <${fromEmail}>`;
    const actionUrl = getActionUrl(payload.link);
    const safeTitle = escapeHtml(payload.title);
    const safeMessage = escapeHtml(payload.message);
    const safeActionUrl = escapeHtml(actionUrl);

    try {
      console.log(`[NotificationChannelService] Attempting to send email to ${to} via ${config.host}...`);
      const info = await transporter.sendMail({
        from,
        to,
        subject: payload.title,
        text: `${payload.message}${actionUrl ? `\n\nOpen: ${actionUrl}` : ''}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <h2 style="margin: 0 0 12px;">${safeTitle}</h2>
            <p style="margin: 0 0 16px;">${safeMessage}</p>
            ${
              actionUrl
                ? `<a href="${safeActionUrl}" style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;">Open</a>`
                : ''
            }
          </div>
        `,
      });
      console.log(`[NotificationChannelService] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
      return { sent: true, skipped: false };
    } catch (err: any) {
      console.error('[NotificationChannelService] Failed to send email:', err);
      throw err;
    }
  }

  static async sendWhatsApp(to: string, payload: NotificationPayload) {
    const { WhatsAppSessionService } = await import('./whatsapp-session.service');
    const status = WhatsAppSessionService.getStatus();

    if (!status.isConfigured) {
      console.warn('[NotificationChannelService] WhatsApp session not connected. WhatsApp message skipped.');
      return { sent: false, skipped: true, reason: 'WHATSAPP_NOT_CONNECTED' };
    }

    const actionUrl = getActionUrl(payload.link);
    const text = `*${payload.title}*\n\n${payload.message}${actionUrl ? `\n\n🔗 ${actionUrl}` : ''}`;

    try {
      const result = await WhatsAppSessionService.sendMessage(to, text);
      return result;
    } catch (err: any) {
      console.error('[NotificationChannelService] WhatsApp send error:', err);
      throw err;
    }
  }
}
