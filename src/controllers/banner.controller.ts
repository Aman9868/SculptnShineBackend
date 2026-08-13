import { Request, Response, NextFunction } from 'express';
import { BannerService } from '../services/banner.service';

export class BannerController {
  static async getAllBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BannerService.getAllBanners(req.query);
      res.status(200).json({
        success: true,
        message: 'Banners fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBannerKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await BannerService.getBannerKPIs();
      res.status(200).json({
        success: true,
        message: 'Banner KPIs fetched successfully',
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBannerById(req: Request, res: Response, next: NextFunction) {
    try {
      const banner = await BannerService.getBannerById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Banner fetched successfully',
        data: banner,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const banner = await BannerService.createBanner(req.body);
      res.status(201).json({
        success: true,
        message: 'Banner created successfully',
        data: banner,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const banner = await BannerService.updateBanner(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Banner updated successfully',
        data: banner,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BannerService.deleteBanner(req.params.id as string);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getPublicBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const banners = await BannerService.getPublicBanners(req.query.type as string | undefined);
      res.status(200).json({
        success: true,
        message: 'Public banners fetched successfully',
        data: banners,
      });
    } catch (error) {
      next(error);
    }
  }
}
