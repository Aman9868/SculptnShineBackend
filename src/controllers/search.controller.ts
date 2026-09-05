import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';

export class SearchController {
  static async globalSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req.query.q as string) || '';
      const limit = Number(req.query.limit) || 5;

      const results = await SearchService.globalSearch(query, limit);

      res.status(200).json({
        success: true,
        message: 'Search results fetched successfully',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

