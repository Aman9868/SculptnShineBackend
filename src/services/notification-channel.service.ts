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

const getEmailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export class NotificationChannelService {
  static async sendEmail(to: string, payload: NotificationPayload) {
    const transporter = getEmailTransporter();

    if (!transporter) {
      console.warn('[NotificationChannelService] SMTP env missing. Email skipped.');
      return { sent: false, skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const actionUrl = getActionUrl(payload.link);
    const safeTitle = escapeHtml(payload.title);
    const safeMessage = escapeHtml(payload.message);
    const safeActionUrl = escapeHtml(actionUrl);

    await transporter.sendMail({
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

    return { sent: true, skipped: false };
  }

  static async sendWhatsApp(to: string, payload: NotificationPayload) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.warn('[NotificationChannelService] WhatsApp env missing. WhatsApp skipped.');
      return { sent: false, skipped: true, reason: 'WHATSAPP_NOT_CONFIGURED' };
    }

    const normalizedPhone = to.replace(/[^\d]/g, '');
    if (!normalizedPhone) {
      return { sent: false, skipped: true, reason: 'INVALID_PHONE' };
    }

    const actionUrl = getActionUrl(payload.link);
    const text = `${payload.title}\n\n${payload.message}${actionUrl ? `\n\n${actionUrl}` : ''}`;

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: {
          preview_url: Boolean(actionUrl),
          body: text,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp send failed: ${response.status} ${errorText}`);
    }

    return { sent: true, skipped: false };
  }
}
