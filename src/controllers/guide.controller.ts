import { Request, Response, NextFunction } from 'express';
import { GuideService } from '../services/guide.service';

export const guideController = {
  getAllGuides: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      let status: boolean | undefined = undefined;
      
      if (req.query.status !== undefined) {
        status = req.query.status === 'true';
      }

      const data = await GuideService.getAllGuides(page, limit, status);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  },

  getGuideById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const data = await GuideService.getGuideById(id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  getGuideBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const data = await GuideService.getGuideBySlug(slug);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  createGuide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await GuideService.createGuide(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  updateGuide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const data = await GuideService.updateGuide(id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  deleteGuide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await GuideService.deleteGuide(id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
};
