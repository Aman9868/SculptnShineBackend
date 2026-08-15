import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import puppeteer from 'puppeteer';
import { prisma } from '../config/prisma';
import fs from 'fs';
import path from 'path';

export class OrderController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const order = await OrderService.createOrderFromCart(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string | undefined;

      const result = await OrderService.getUserOrders(userId, page, limit, status);
      res.status(200).json({
        success: true,
        message: 'User orders fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAdminOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await OrderService.getAdminOrders(page, limit, status, search, startDate, endDate);
      res.status(200).json({
        success: true,
        message: 'Admin orders fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'ADMIN';
      const order = await OrderService.getOrderById(req.params.id as string, userId, isAdmin);
      res.status(200).json({
        success: true,
        message: 'Order details fetched',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, trackingNumber, comment } = req.body;
      const order = await OrderService.updateOrderStatus(req.params.id as string, status, trackingNumber, comment);
      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { reason } = req.body;
      const order = await OrderService.cancelOrder(userId, req.params.id as string, reason);
      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
  static async downloadInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'ADMIN';
      const order = await OrderService.getOrderById(req.params.id as string, userId, isAdmin);
      
      const businessConfig = await prisma.businessConfig.findFirst() || {
        brandName: 'Sculpt & Shine',
        address: '123 Wellness Ave',
        supportPhone: '+91 98765 43210',
        supportEmail: 'support@sculptnshine.com',
        gstNumber: 'GSTIN123456789'
      };

      const addresses = await prisma.address.findMany({ where: { userProfileId: order.userProfileId } });
      const defaultAddress = addresses.find((a: any) => a.isDefault) || addresses[0];

      let logoSvg = '';
      try {
        logoSvg = fs.readFileSync(path.join(process.cwd(), 'src/assets/logo.svg'), 'utf-8');
      } catch (e) {
        logoSvg = '<div class="logo-icon">S</div>';
      }

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Invoice - ${order.orderNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 15px 20px; color: #333; margin: 0; background-color: #fff; font-size: 11px; }
            * { box-sizing: border-box; }
            
            /* Header */
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
            .logo-container { width: 180px; }
            .logo-container svg { width: 100%; height: auto; }
            
            .contact-info { margin-top: 8px; font-size: 10px; color: #555; }
            .contact-info p { margin: 2px 0; }
            
            .invoice-details { text-align: right; }
            .invoice-details h2 { margin: 0 0 8px 0; color: #1a1b22; font-size: 24px; letter-spacing: 1px; font-weight: 700; }
            .details-grid { display: grid; grid-template-columns: auto auto; gap: 4px 12px; text-align: right; font-size: 10px; }
            .details-grid .label { color: #1a1b22; font-weight: 700; }
            .details-grid .value { color: #555; }
            .status-badge { background-color: #e6f4ea; color: #1e8e3e; padding: 2px 6px; border-radius: 3px; font-weight: 700; font-size: 9px; display: inline-block; }
            
            hr.gold-line { border: none; border-top: 1.5px solid #d8ab60; margin: 12px 0; }
            
            /* Addresses */
            .addresses { display: flex; justify-content: space-between; margin-bottom: 15px; gap: 15px; }
            .address-col { flex: 1; font-size: 10px; color: #444; line-height: 1.5; }
            .address-title { color: #d8ab60; font-weight: 700; font-size: 10px; margin-bottom: 6px; text-transform: uppercase; }
            .delivery-method { margin-top: 8px; background-color: #fff9f0; border-radius: 6px; padding: 8px; border: 1px solid #f1ebd9; }
            .delivery-method h4 { margin: 0 0 2px 0; font-size: 10px; color: #1a1b22; }
            .delivery-method p { margin: 0; font-size: 9px; color: #666; }
            
            /* Table */
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { padding: 6px 8px; text-align: left; font-size: 10px; }
            th { background-color: #1a1b22; color: #fff; font-weight: 600; text-transform: uppercase; font-size: 8px; letter-spacing: 0.3px; }
            th:first-child { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
            th:last-child { border-top-right-radius: 4px; border-bottom-right-radius: 4px; }
            td { border-bottom: 1px solid #eee; vertical-align: top; }
            .right { text-align: right; }
            .center { text-align: center; }
            .item-title { font-weight: 600; color: #1a1b22; margin-bottom: 2px; display: block; font-size: 10px; }
            .item-variant { color: #666; font-size: 9px; }
            
            /* Totals */
            .totals-container { display: flex; justify-content: flex-end; margin-bottom: 15px; }
            .totals { width: 280px; }
            .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #444; }
            .totals-row.grand { font-size: 15px; font-weight: 700; color: #d8ab60; padding-top: 8px; margin-top: 6px; border-top: 1px solid #eee; }
            .tax-note { text-align: right; font-size: 9px; color: #666; margin-top: 2px; }
            
            /* Help / Footer */
            .help-section { display: flex; justify-content: space-between; align-items: stretch; background-color: #fff9f0; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
            .thank-you { flex: 1; padding: 12px 15px; display: flex; align-items: center; gap: 10px; }
            .thank-you-text h4 { margin: 0 0 3px 0; font-size: 11px; font-weight: 700; color: #1a1b22; }
            .thank-you-text p { margin: 0; font-size: 9px; color: #555; line-height: 1.4; }
            
            .need-help { flex: 1; padding: 12px 15px; border-left: 1px solid #f1ebd9; }
            .need-help h4 { margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #d8ab60; }
            .help-item { margin-bottom: 4px; font-size: 9px; color: #555; }
            
            @media print {
              body { padding: 0; -webkit-print-color-adjust: exact; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo-container">
                ${logoSvg}
              </div>
              <div class="contact-info">
                <p>Phone: ${businessConfig.supportPhone || '+91 98765 43210'}</p>
                <p>Email: ${businessConfig.supportEmail || 'contact@sculptnshine.com'}</p>
                <p>Web: www.sculptnshine.com</p>
              </div>
            </div>
            <div class="invoice-details">
              <h2>INVOICE</h2>
              <div class="details-grid">
                <span class="label">Order #:</span>
                <span class="value">${order.orderNumber}</span>
                <span class="label">Invoice Date:</span>
                <span class="value">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span class="label">GSTIN:</span>
                <span class="value">${businessConfig.gstNumber || 'N/A'}</span>
                <span class="label">Order Date:</span>
                <span class="value">${new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span class="label">Payment Method:</span>
                <span class="value">${order.paymentStatus === 'COMPLETED' ? 'Online Payment' : 'Pending'}</span>
                <span class="label">Status:</span>
                <span class="value"><span class="status-badge">${order.status === 'DELIVERED' ? 'COMPLETED' : order.status.replace(/_/g, ' ')}</span></span>
              </div>
            </div>
          </div>
          
          <hr class="gold-line" />
          
          <div class="addresses">
            <div class="address-col">
              <div class="address-title">BILLED TO</div>
              ${defaultAddress ? `
                <strong>${order.userProfile?.user?.firstName} ${order.userProfile?.user?.lastName}</strong><br>
                ${order.userProfile?.user?.email}<br>
                ${defaultAddress.flatHouse}, ${defaultAddress.areaStreet}${defaultAddress.landmark ? ', ' + defaultAddress.landmark : ''}<br>
                ${defaultAddress.townCity}, ${defaultAddress.state} - ${defaultAddress.pincode}<br>
                Phone: ${order.shippingPhone}
              ` : `
                <strong>${order.userProfile?.user?.firstName} ${order.userProfile?.user?.lastName}</strong><br>
                ${order.userProfile?.user?.email}
              `}
            </div>
            <div class="address-col">
              <div class="address-title">SHIPPED TO</div>
              <strong>${order.shippingName}</strong><br>
              ${order.shippingAddress}<br>
              ${order.shippingCity}, ${order.shippingState} - ${order.shippingPincode}<br>
              Phone: ${order.shippingPhone}
            </div>
            <div class="address-col">
              <div class="address-title">DELIVERY ADDRESS</div>
              <strong>${order.shippingName}</strong><br>
              ${order.shippingAddress}<br>
              ${order.shippingCity}, ${order.shippingState} - ${order.shippingPincode}<br>
              Phone: ${order.shippingPhone}
              
              <div class="delivery-method">
                <div>
                  <h4>Delivery Method</h4>
                  <p>Standard Delivery (3-5 Business Days)</p>
                </div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="center" style="width: 4%">#</th>
                <th style="width: 30%">ITEM DESCRIPTION</th>
                <th class="center" style="width: 6%">QTY</th>
                <th class="right" style="width: 12%">UNIT PRICE</th>
                <th class="right" style="width: 12%">TAXABLE AMT</th>
                <th class="center" style="width: 8%">GST %</th>
                <th class="right" style="width: 12%">CGST</th>
                <th class="right" style="width: 12%">SGST</th>
                <th class="right" style="width: 12%">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item: any, idx: number) => {
                const lineTotal = item.unitPrice * item.quantity;
                const taxableAmount = lineTotal / (1 + item.gst / 100);
                const gstAmount = lineTotal - taxableAmount;
                const cgst = gstAmount / 2;
                const sgst = gstAmount / 2;
                return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td>
                    <span class="item-title">${item.productName}</span>
                    ${item.variant ? `<span class="item-variant">Variant: ${item.variant.title}</span>` : ''}
                  </td>
                  <td class="center">${item.quantity}</td>
                  <td class="right">₹${item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="right">₹${taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${item.gst}%</td>
                  <td class="right">₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="right">₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="right">₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>

          ${(() => {
            let totalTaxable = 0;
            let totalCgst = 0;
            let totalSgst = 0;
            order.items.forEach((item: any) => {
              const lineTotal = item.unitPrice * item.quantity;
              const taxable = lineTotal / (1 + item.gst / 100);
              const gst = lineTotal - taxable;
              totalTaxable += taxable;
              totalCgst += gst / 2;
              totalSgst += gst / 2;
            });
            return `
          <div class="totals-container">
            <div class="totals">
              <div class="totals-row">
                <span>Taxable Amount</span>
                <span>₹${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="totals-row">
                <span>CGST</span>
                <span>₹${totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="totals-row">
                <span>SGST</span>
                <span>₹${totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="totals-row">
                <span>Shipping Charges</span>
                <span>₹${order.shippingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              ${((order as any).couponDiscount && (order as any).couponDiscount > 0) || ((order as any).discountAmount && (order as any).discountAmount > 0) ? `
              <div class="totals-row" style="color: #c05621; font-weight: 600;">
                <span>Coupon Discount ${(order as any).couponCode ? `(${(order as any).couponCode})` : ''}</span>
                <span>- ₹${((order as any).couponDiscount || (order as any).discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              ` : `
              <div class="totals-row">
                <span>Discount</span>
                <span>- ₹0.00</span>
              </div>
              `}
              <div class="totals-row grand">
                <span>TOTAL</span>
                <span>₹${order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="tax-note">(Inclusive of GST)</div>
            `;
          })()}
            </div>
          </div>

          <div class="help-section">
            <div class="thank-you">
              <div class="thank-you-text">
                <h4>Thank you for shopping with Sculpt & Shine!</h4>
                <p>We appreciate your trust in us. If you have any questions about this invoice, please contact our support team.</p>
              </div>
            </div>
            <div class="need-help">
              <h4>Need Help?</h4>
              <div class="help-item">Phone: ${businessConfig.supportPhone || '+91 98765 43210'}</div>
              <div class="help-item">Email: ${businessConfig.supportEmail || 'support@sculptnshine.com'}</div>
              <div class="help-item">Hours: Mon - Sat (10AM - 7PM)</div>
            </div>
          </div>


          <div style="text-align: center; margin-top: 10px; font-size: 9px; color: #888;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Sculpt & Shine. All Rights Reserved.</p>
          </div>
        </body>
        </html>
      `;

      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      next(error);
    }
  }

  static async trackOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber, emailOrPhone } = req.body;
      
      if (!orderNumber || !emailOrPhone) {
        return res.status(400).json({
          success: false,
          message: 'Order Number and Email/Phone are required.'
        });
      }

      const orderData = await OrderService.trackOrder(orderNumber, emailOrPhone);

      res.status(200).json({
        success: true,
        message: 'Order tracking data retrieved successfully',
        data: orderData
      });
    } catch (error) {
      next(error);
    }
  }
}
