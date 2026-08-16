import { prisma } from '../config/prisma';
import { getRequestContext } from '../config/request-context';

export type LogStatus = 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';

export interface LogEventInput {
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: LogStatus;
  details?: any;
}

export class DbLoggerService {
  /**
   * Main non-blocking audit / journal logger.
   * Merges with request context (userId, userEmail, IP, User-Agent) automatically.
   */
  static async log(event: LogEventInput): Promise<void> {
    const ctx = getRequestContext();

    const userId = event.userId || ctx.userId || undefined;
    const userEmail = event.userEmail || ctx.userEmail || undefined;
    const ipAddress = event.ipAddress || ctx.ipAddress || undefined;
    const userAgent = event.userAgent || ctx.userAgent || undefined;
    const status = event.status || 'SUCCESS';

    try {
      await (prisma as any).auditLog.create({
        data: {
          action: event.action,
          entity: event.entity,
          entityId: event.entityId ? String(event.entityId) : null,
          userId,
          userEmail,
          ipAddress,
          userAgent,
          status,
          details: event.details !== undefined ? event.details : null,
        },
      });
    } catch (error: any) {
      // Never allow audit logging failure to crash or block customer requests
      console.warn(`[DbLoggerService] Failed to record log "${event.action}":`, error.message);
    }
  }

  /**
   * Order Lifecycle Logging
   */
  static async logOrder(
    action: 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'ORDER_CANCELLED' | 'ORDER_REFUNDED' | 'ORDER_UPDATED',
    orderId: string,
    details?: any,
    status: LogStatus = 'SUCCESS',
    userInfo?: { userId?: string; userEmail?: string }
  ) {
    return this.log({
      action,
      entity: 'Order',
      entityId: orderId,
      userId: userInfo?.userId,
      userEmail: userInfo?.userEmail,
      status,
      details,
    });
  }

  /**
   * Payment Lifecycle Logging
   */
  static async logPayment(
    action: 'PAYMENT_INITIATED' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'PAYMENT_WEBHOOK_RECEIVED',
    orderId: string,
    paymentId?: string,
    details?: any,
    status: LogStatus = 'SUCCESS',
    userInfo?: { userId?: string; userEmail?: string }
  ) {
    return this.log({
      action,
      entity: 'Payment',
      entityId: paymentId || orderId,
      userId: userInfo?.userId,
      userEmail: userInfo?.userEmail,
      status,
      details: {
        orderId,
        paymentId,
        ...details,
      },
    });
  }

  /**
   * Product & Inventory Lifecycle Logging
   */
  static async logProduct(
    action: 'PRODUCT_CREATED' | 'PRODUCT_UPDATED' | 'PRODUCT_DELETED' | 'STOCK_ADJUSTED' | 'BULK_UPLOAD',
    productId?: string,
    details?: any,
    status: LogStatus = 'SUCCESS'
  ) {
    return this.log({
      action,
      entity: 'Product',
      entityId: productId,
      status,
      details,
    });
  }

  /**
   * Product Search & Filter Query Logging
   */
  static async logCatalogSearch(
    query?: string,
    filters?: Record<string, any>,
    resultsCount?: number
  ) {
    // Only log if meaningful search or filter was applied
    if (!query && (!filters || Object.keys(filters).length === 0)) {
      return;
    }

    return this.log({
      action: 'CATALOG_SEARCH_FILTER',
      entity: 'CatalogSearch',
      status: 'INFO',
      details: {
        searchQuery: query || null,
        filters: filters || null,
        resultsCount: resultsCount !== undefined ? resultsCount : null,
      },
    });
  }

  /**
   * Category & Subcategory Logging
   */
  static async logCategory(
    action: 'CATEGORY_CREATED' | 'CATEGORY_UPDATED' | 'CATEGORY_DELETED' | 'SUBCATEGORY_CREATED' | 'SUBCATEGORY_UPDATED' | 'SUBCATEGORY_DELETED',
    categoryId: string,
    details?: any,
    status: LogStatus = 'SUCCESS'
  ) {
    return this.log({
      action,
      entity: action.includes('SUBCATEGORY') ? 'Subcategory' : 'Category',
      entityId: categoryId,
      status,
      details,
    });
  }

  /**
   * Brand Logging
   */
  static async logBrand(
    action: 'BRAND_CREATED' | 'BRAND_UPDATED' | 'BRAND_DELETED',
    brandId: string,
    details?: any,
    status: LogStatus = 'SUCCESS'
  ) {
    return this.log({
      action,
      entity: 'Brand',
      entityId: brandId,
      status,
      details,
    });
  }

  /**
   * Coupon Logging
   */
  static async logCoupon(
    action: 'COUPON_CREATED' | 'COUPON_UPDATED' | 'COUPON_DELETED' | 'COUPON_APPLIED',
    couponId: string,
    code?: string,
    details?: any,
    status: LogStatus = 'SUCCESS'
  ) {
    return this.log({
      action,
      entity: 'Coupon',
      entityId: couponId,
      status,
      details: {
        code,
        ...details,
      },
    });
  }

  /**
   * Auth & Security Logging
   */
  static async logAuth(
    action: 'USER_LOGIN' | 'USER_REGISTERED' | 'PASSWORD_RESET' | 'ADMIN_LOGIN' | 'LOGIN_FAILED',
    userId?: string,
    email?: string,
    status: LogStatus = 'SUCCESS',
    details?: any
  ) {
    return this.log({
      action,
      entity: 'Auth',
      entityId: userId,
      userId,
      userEmail: email,
      status,
      details,
    });
  }

  /**
   * Support Ticket Logging
   */
  static async logTicket(
    action: 'TICKET_CREATED' | 'TICKET_STATUS_CHANGED' | 'TICKET_REPLIED',
    ticketId: string,
    details?: any,
    status: LogStatus = 'SUCCESS'
  ) {
    return this.log({
      action,
      entity: 'SupportTicket',
      entityId: ticketId,
      status,
      details,
    });
  }
}

export default DbLoggerService;
