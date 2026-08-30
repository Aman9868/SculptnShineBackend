import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export class ReplenishmentController {
  static async getMyReplenishments(req: Request, res: Response, next: NextFunction) {
    try {
      const userProfileId = req.user!.userId;

      const replenishments = await prisma.replenishmentSchedule.findMany({
        where: {
          userProfileId,
          notificationStatus: {
            in: ['PENDING', 'NOTIFIED'],
          },
        },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
          variant: {
            select: {
              id: true,
              title: true,
              unitPrice: true,
              discountPercentage: true,
              sku: true,
              weight: true,
            },
          },
        },
        orderBy: {
          estimatedRunOutDate: 'asc',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Replenishments fetched successfully',
        data: replenishments,
      });
    } catch (error) {
      next(error);
    }
  }
}
