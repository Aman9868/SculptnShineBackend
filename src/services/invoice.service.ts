import { prisma } from '../config/prisma';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class InvoiceService {
  static async generateInvoice(orderId: string): Promise<string> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        userProfile: {
          include: { user: true },
        },
      },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }

    const config = await prisma.businessConfig.findFirst();
    if (!config) {
      throw createError(500, 'Business configuration not found');
    }

    let templatePath = path.join(__dirname, '../templates/invoice.ejs');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'src/templates/invoice.ejs');
    }
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'dist/templates/invoice.ejs');
    }

    // Ensure template exists
    if (!fs.existsSync(templatePath)) {
      throw createError(500, 'Invoice template not found');
    }

    const html = await ejs.renderFile(templatePath, { order, config });

    const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const fileName = `invoice-${order.orderNumber}.pdf`;
    const filePath = path.join(invoicesDir, fileName);

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (fs.existsSync('/usr/bin/chromium-browser') ? '/usr/bin/chromium-browser' :
        fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();

    const invoiceUrl = `/invoices/${fileName}`;

    await prisma.order.update({
      where: { id: orderId },
      data: { invoiceUrl } as any,
    });

    return invoiceUrl;
  }

  static async sendInvoiceEmail(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        userProfile: {
          include: { user: true },
        },
      },
    });

    if (!order || !(order as any).invoiceUrl) {
      throw createError(404, 'Order or Invoice not found');
    }

    const config = await prisma.businessConfig.findFirst();
    const userEmail = order.userProfile.user.email;
    const userName = order.userProfile.user.firstName || order.shippingName;

    const filePath = path.join(process.cwd(), 'public', (order as any).invoiceUrl);

    if (!fs.existsSync(filePath)) {
      throw createError(404, 'Invoice PDF file not found on disk');
    }

    // Use ethereal email for testing since we don't have real SMTP credentials
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${config?.brandName || 'Sculpt N Shine'}" <no-reply@sculptnshine.com>`,
      to: userEmail,
      subject: `Your Invoice for Order ${order.orderNumber}`,
      text: `Hi ${userName},\n\nThank you for your order! Please find attached the invoice for order ${order.orderNumber}.\n\nBest regards,\n${config?.brandName || 'Sculpt N Shine'}`,
      attachments: [
        {
          filename: `Invoice-${order.orderNumber}.pdf`,
          path: filePath,
        },
      ],
    });

    console.log(`[InvoiceService] Email sent: ${info.messageId}`);
    console.log(`[InvoiceService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
}
