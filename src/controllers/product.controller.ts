import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';

export class ProductController {
  static async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.getAllProducts(req.query);
      res.status(200).json({
        success: true,
        message: 'Products fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
  static async getFilters(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = await ProductService.getFilters(req.query);
      res.status(200).json({
        success: true,
        message: 'Product filters fetched successfully',
        data: filters,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.getProductById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Product fetched successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.createProduct(req.body);
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.updateProduct(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.deleteProduct(req.params.id as string);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await ProductService.getInventoryStatus();
      res.status(200).json({
        success: true,
        message: 'Inventory status fetched successfully',
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}
