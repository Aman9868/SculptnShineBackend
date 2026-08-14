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
      const {
        brandName,
        address,
        gstNumber,
        supportEmail,
        supportPhone,
        instagramUrl,
        facebookUrl,
        youtubeUrl,
      } = req.body;

      const config = await BusinessConfigService.upsertConfig({
        brandName,
        address,
        gstNumber,
        supportEmail,
        supportPhone,
        instagramUrl,
        facebookUrl,
        youtubeUrl,
      });
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
