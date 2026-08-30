import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service';

export class CategoryController {
  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.createCategory(req.body);
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const status = req.query.status as string;

      const result = await CategoryService.getAllCategories(page, limit, search, status);
      res.status(200).json({
        success: true,
        message: 'Categories fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.getCategoryById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Category fetched successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryFilters(req: Request, res: Response, next: NextFunction) {
    try {
      const subcategorySlug = req.query.subcategorySlug as string | undefined;
      const filters = await CategoryService.getCategoryFilters(req.params.id as string, subcategorySlug);
      res.status(200).json({
        success: true,
        message: 'Category filters fetched successfully',
        data: filters,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.updateCategory(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await CategoryService.deleteCategory(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await CategoryService.getCategoryKPIs();
      res.status(200).json({
        success: true,
        message: 'Category KPIs fetched successfully',
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const csvData = await CategoryService.exportCategories();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="categories.csv"');
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }
}
