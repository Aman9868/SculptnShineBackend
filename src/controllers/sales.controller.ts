import { Request, Response, NextFunction } from 'express';
import { SalesService } from '../services/sales.service';

export class SalesController {
  static async getSalesKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await SalesService.getSalesKPIs();
      res.status(200).json({
        success: true,
        message: 'Sales KPIs fetched successfully',
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSalesAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const analytics = await SalesService.getSalesAnalytics();
      res.status(200).json({
        success: true,
        message: 'Sales analytics fetched successfully',
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const csvData = await SalesService.exportSalesReport();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales_report.csv"');
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }
}
