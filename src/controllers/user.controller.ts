import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  static async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;

      const result = await UserService.getAllUsers(page, limit, search, role);
      res.status(200).json({
        success: true,
        message: 'Users fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const newUser = await UserService.createUser(req.body);
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserKPIs(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await UserService.getUserKPIs();
      res.status(200).json({
        success: true,
        message: 'User KPIs fetched successfully',
        data: kpis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id === 'me' ? req.user!.userId : (req.params.id as string);
      const user = await UserService.getUserById(userId);

      res.status(200).json({
        success: true,
        message: 'User profile fetched successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id === 'me' ? req.user!.userId : (req.params.id as string);
      const updatedUser = await UserService.updateUser(userId, req.body, req.user);

      res.status(200).json({
        success: true,
        message: 'User profile updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id === 'me' ? req.user!.userId : (req.params.id as string);
      
      // If a user tries to change someone else's password and they aren't admin, forbid it
      if (req.params.id !== 'me' && req.params.id !== req.user!.userId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      await UserService.changePassword(userId, req.body);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
  static async changeUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const user = await UserService.changeUserStatus(req.params.id as string, status);
      res.status(200).json({
        success: true,
        message: 'User status updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const csvData = await UserService.exportUsers();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }
}
