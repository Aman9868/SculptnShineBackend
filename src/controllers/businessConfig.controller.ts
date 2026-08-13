import { Request, Response, NextFunction } from 'express';
import { BusinessConfigService } from '../services/businessConfig.service';

export class BusinessConfigController {
  static async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await BusinessConfigService.getConfig();
      res.status(200).json({
        success: true,
        message: 'Business configuration fetched successfully',
        data: config || {},
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await BusinessConfigService.upsertConfig(req.body);
      res.status(200).json({
        success: true,
        message: 'Business configuration updated successfully',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }
}
