import { Request, Response, NextFunction } from 'express';
import { SubcategoryService } from '../services/subcategory.service';

export class SubcategoryController {
  static async getAllSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await SubcategoryService.getAllSubcategories(categoryId, page, limit, search);
      res.status(200).json({
        success: true,
        message: 'Subcategories fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSubcategoryKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const kpis = await SubcategoryService.getSubcategoryKPIs(categoryId);
      res.status(200).json({
        success: true,
        message: 'Subcategory KPIs fetched successfully',
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const csvData = await SubcategoryService.exportSubcategories(categoryId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="subcategories.csv"');
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }

  static async getSubcategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const subcategory = await SubcategoryService.getSubcategoryById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Subcategory fetched successfully',
        data: subcategory,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const newSubcategory = await SubcategoryService.createSubcategory(req.body);
      res.status(201).json({
        success: true,
        message: 'Subcategory created successfully',
        data: newSubcategory,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const updatedSubcategory = await SubcategoryService.updateSubcategory(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Subcategory updated successfully',
        data: updatedSubcategory,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SubcategoryService.deleteSubcategory(req.params.id as string);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
