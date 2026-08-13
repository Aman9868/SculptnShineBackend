import { Request, Response, NextFunction } from 'express';
import { PolicyService } from '../services/policy.service';

export class PolicyController {
  static async getAllPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || '';

      const result = await PolicyService.getAllPolicies({ page, limit, search });
      res.status(200).json({
        success: true,
        message: 'Policies fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPolicyByIdOrType(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const policy = await PolicyService.getPolicyByIdOrType(id as string);
      
      if (!policy) {
        return res.status(404).json({
          success: false,
          message: `Policy not found`,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Policy fetched successfully',
        data: policy,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, type, content, isActive } = req.body;

      if (!title || !type || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title, type, and content are required',
        });
      }

      const policy = await PolicyService.createPolicy({ title, type, content, isActive });
      
      res.status(201).json({
        success: true,
        message: 'Policy created successfully',
        data: policy,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Policy with this type already exists' });
      }
      next(error);
    }
  }

  static async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      let policyId = id as string;
      const existing = await PolicyService.getPolicyByIdOrType(id as string);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Policy not found' });
      }
      policyId = existing.id;

      const { title, type, content, isActive } = req.body;

      const policy = await PolicyService.updatePolicy(policyId, { title, type, content, isActive });
      
      res.status(200).json({
        success: true,
        message: 'Policy updated successfully',
        data: policy,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Policy with this type already exists' });
      }
      next(error);
    }
  }

  static async deletePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const existing = await PolicyService.getPolicyByIdOrType(id as string);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Policy not found' });
      }

      await PolicyService.deletePolicy(existing.id);
      
      res.status(200).json({
        success: true,
        message: 'Policy deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
