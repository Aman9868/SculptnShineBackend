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

  static async bulkUpload(req: Request, res: Response, next: NextFunction) {
    try {
      let productsData = req.body.products;

      // If file was uploaded via multipart/form-data
      if (req.file) {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        productsData = XLSX.utils.sheet_to_json(worksheet);
      } else if (typeof productsData === 'string') {
        try {
          productsData = JSON.parse(productsData);
        } catch (e) {
          // ignore
        }
      }

      if (!Array.isArray(productsData) || productsData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No product rows found in request or uploaded file',
        });
      }

      const results = await ProductService.bulkUploadProducts(productsData);

      res.status(200).json({
        success: true,
        message: `Bulk upload completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSampleTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const sampleData = ProductService.getSampleTemplateData();
      const format = req.query.format;

      if (format === 'xlsx') {
        const XLSX = require('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample_Products');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="sculptnshine_product_upload_sample.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
      }

      res.status(200).json({
        success: true,
        message: 'Sample template data retrieved successfully',
        data: sampleData,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportProductsExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const products = await ProductService.exportProductsForExcel(req.query);
      const XLSX = require('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(products);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products_Catalog');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="sculptnshine_products_export.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

