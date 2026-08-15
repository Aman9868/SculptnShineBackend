import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';
import { prisma } from '../config/prisma';

export class CouponController {
  // Admin: Create Coupon
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await CouponService.createCoupon(req.body);
      res.status(201).json({
        success: true,
        message: 'Coupon created successfully',
        data: coupon,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: List Coupons with analytics
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CouponService.getAdminCoupons(req.query as any);
      res.status(200).json({
        success: true,
        message: 'Coupons fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get Single Coupon
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await CouponService.getCouponById(req.params.id as string);
      res.status(200).json({
        success: true,
        data: coupon,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update Coupon
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await CouponService.updateCoupon(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Coupon updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Toggle Status
  static async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await CouponService.toggleCouponStatus(req.params.id as string);
      res.status(200).json({
        success: true,
        message: `Coupon is now ${updated.isActive ? 'Active' : 'Inactive'}`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Delete Coupon
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CouponService.deleteCoupon(req.params.id as string);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Get Visible / Public Vouchers
  static async getPublicVouchers(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, categoryId, brandId } = req.query as any;
      const coupons = await CouponService.getPublicCoupons({ productId, categoryId, brandId });
      res.status(200).json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      next(error);
    }
  }

  // Public: Get Top Featured Announcement Coupon for Header Banner
  static async getAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const announcement = await CouponService.getFeaturedAnnouncement();
      res.status(200).json({
        success: true,
        data: announcement,
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Validate Coupon against user's cart
  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ success: false, message: 'Please provide a coupon code' });
      }

      let userProfileId = '';
      let cartItems: any[] = [];
      let subtotal = 0;

      if (userId) {
        const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
        if (userProfile) {
          userProfileId = userProfile.id;
          const cart = await prisma.cart.findUnique({
            where: { userProfileId },
            include: {
              items: {
                include: { product: true, variant: true },
              },
            },
          });
          if (cart) {
            cartItems = cart.items;
            subtotal = cart.items.reduce((sum, item) => {
              const uPrice = item.variant ? item.variant.unitPrice : item.product.unitPrice;
              const discPct = item.variant ? (item.variant.discountPercentage || 0) : (item.product.discountPercentage || 0);
              const gst = item.variant ? item.variant.gst : item.product.gst;
              const afterDisc = uPrice * (1 - discPct / 100);
              const finalItemPrice = afterDisc * (1 + gst / 100);
              return sum + finalItemPrice * item.quantity;
            }, 0);
          }
        }
      }

      // If cartItems passed in body (e.g. preview before save)
      if (req.body.cartItems && req.body.cartItems.length > 0) {
        cartItems = req.body.cartItems;
      }
      if (req.body.subtotal !== undefined) {
        subtotal = Number(req.body.subtotal);
      }

      const result = await CouponService.validateAndCalculateDiscount(
        code,
        userProfileId,
        cartItems,
        subtotal
      );

      res.status(200).json({
        success: true,
        message: `Coupon '${result.coupon.code}' applied! You saved ₹${result.discountAmount}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
