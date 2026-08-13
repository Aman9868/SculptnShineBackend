import { Request, Response, NextFunction } from 'express';
import { AddressService } from '../services/address.service';

export class AddressController {
  static async getAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const addresses = await AddressService.getAddresses(userId);
      res.status(200).json({
        success: true,
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  }
  static async createAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const address = await AddressService.createAddress(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Address created successfully',
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { addressId } = req.params;
      if (!addressId) {
        return res.status(400).json({ success: false, message: 'addressId is required' });
      }
      const updatedAddress = await AddressService.updateAddress(addressId as string, userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        data: updatedAddress,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { addressId } = req.params;
      if (!addressId) {
        return res.status(400).json({ success: false, message: 'addressId is required' });
      }
      await AddressService.deleteAddress(addressId as string, userId);
      res.status(200).json({
        success: true,
        message: 'Address deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
