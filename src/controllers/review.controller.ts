import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const reviewController = {
  checkEligibility: async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
      }

      const isEligible = await reviewService.checkEligibility(productId, profile.id);
      return res.status(200).json({ success: true, isEligible });
    } catch (error: any) {
      console.error('Error checking review eligibility:', error);
      return res.status(500).json({ success: false, message: 'Failed to check eligibility' });
    }
  },
  // Public / User Routes
  getProductReviews: async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const { limit } = req.query;

      const reviews = await reviewService.getProductReviews(productId, {
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      return res.status(200).json({ success: true, data: reviews });
    } catch (error: any) {
      console.error('Error fetching product reviews:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
  },

  getFeaturedReviews: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const reviews = await reviewService.getAllReviewsAdmin({
        status: 'APPROVED',
        rating: 5,
        limit,
      } as any);
      res.status(200).json({ success: true, data: reviews });
    } catch (error) {
      next(error);
    }
  },

  addReview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, rating, title, comment, images } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!productId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Product ID and a valid rating (1-5) are required' });
      }

      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
      }

      // Check if user has purchased this product to flag as verified
      const hasPurchased = await prisma.orderItem.findFirst({
        where: {
          productId: productId,
          order: {
            userProfileId: profile.id,
            status: 'DELIVERED' // Consider verified if it's delivered
          }
        }
      });

      const review = await reviewService.addReview({
        productId,
        userProfileId: profile.id,
        rating: Number(rating),
        title,
        comment,
        images,
        isVerifiedPurchase: !!hasPurchased
      });

      return res.status(201).json({ success: true, data: review });
    } catch (error: any) {
      console.error('Error adding review:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to add review' });
    }
  },

  // Admin Routes
  addAdminReview: async (req: Request, res: Response) => {
    try {
      const { productId, rating, title, comment, images } = req.body;

      if (!productId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Product ID and a valid rating (1-5) are required' });
      }

      // Admin reviews are anonymous or detached from a specific user profile
      const review = await reviewService.addReview({
        productId,
        rating: Number(rating),
        title,
        comment,
        images,
        isVerifiedPurchase: true, // Mark admin reviews as verified
        isAdminCreated: true
      });

      return res.status(201).json({ success: true, data: review });
    } catch (error: any) {
      console.error('Error adding admin review:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to add review' });
    }
  },

  getAllReviewsAdmin: async (req: Request, res: Response) => {
    try {
      const { status, search } = req.query;

      const reviews = await reviewService.getAllReviewsAdmin({
        status: status as any,
        search: search as string
      });

      return res.status(200).json({ success: true, data: reviews });
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
  },

  updateReviewStatus: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const review = await reviewService.updateReviewStatus(id, status);
      return res.status(200).json({ success: true, data: review });
    } catch (error: any) {
      console.error('Error updating review status:', error);
      return res.status(500).json({ success: false, message: 'Failed to update review status' });
    }
  },

  deleteReview: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await reviewService.deleteReview(id);
      return res.status(200).json({ success: true, message: 'Review deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting review:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete review' });
    }
  },

  updateReview: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { rating, title, comment } = req.body;
      
      const review = await reviewService.updateReview(id, { rating, title, comment });
      return res.status(200).json({ success: true, data: review });
    } catch (error: any) {
      console.error('Error updating review:', error);
      return res.status(500).json({ success: false, message: 'Failed to update review' });
    }
  }
};
