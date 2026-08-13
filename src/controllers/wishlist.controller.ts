import { Request, Response, NextFunction } from 'express';
import { WishlistService } from '../services/wishlist.service';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

export class WishlistController {
  static async toggleWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { productId } = req.params;

      // Ensure user has a profile
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true }
      });

      if (!user || !user.profile) {
        throw { statusCode: 404, message: 'User profile not found' } as AppError;
      }

      const result = await WishlistService.toggleWishlist(user.profile.id, productId as string);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { isAdded: result.isAdded }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Ensure user has a profile
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true }
      });

      if (!user || !user.profile) {
        throw { statusCode: 404, message: 'User profile not found' } as AppError;
      }

      const result = await WishlistService.getWishlist(user.profile.id, page, limit);

      res.status(200).json({
        success: true,
        message: 'Wishlist retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
