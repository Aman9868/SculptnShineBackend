import { Request, Response, NextFunction } from 'express';
import { BrandService } from '../services/brand.service';

export class BrandController {
  static async getAllBrands(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BrandService.getAllBrands(req.query);
      res.status(200).json({
        success: true,
        message: 'Brands fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTopSellingBrands(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 8;
      const result = await BrandService.getTopSellingBrands(limit);
      res.status(200).json({
        success: true,
        message: 'Top selling brands fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBrandKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await BrandService.getBrandKPIs();
      res.status(200).json({
        success: true,
        message: 'Brand KPIs fetched successfully',
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBrandById(req: Request, res: Response, next: NextFunction) {
    try {
      const brand = await BrandService.getBrandById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Brand fetched successfully',
        data: brand,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const brand = await BrandService.createBrand(req.body);
      res.status(201).json({
        success: true,
        message: 'Brand created successfully',
        data: brand,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const brand = await BrandService.updateBrand(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Brand updated successfully',
        data: brand,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BrandService.deleteBrand(req.params.id as string);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
