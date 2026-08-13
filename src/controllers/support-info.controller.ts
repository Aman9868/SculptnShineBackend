import { Request, Response } from 'express';
import { supportInfoService } from '../services/support-info.service';

export const supportInfoController = {
  getAllSupportInfo: async (req: Request, res: Response) => {
    try {
      const data = await supportInfoService.getAllSupportInfo();
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error('Error fetching support info:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch support info' });
    }
  },

  getSupportInfoById: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const data = await supportInfoService.getSupportInfoById(id);
      if (!data) return res.status(404).json({ success: false, message: 'Support info not found' });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error('Error fetching support info:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch support info' });
    }
  },

  createSupportInfo: async (req: Request, res: Response) => {
    try {
      const data = await supportInfoService.createSupportInfo(req.body);
      res.status(201).json({ success: true, data, message: 'Support info created successfully' });
    } catch (error: any) {
      console.error('Error creating support info:', error);
      res.status(500).json({ success: false, message: 'Failed to create support info' });
    }
  },

  updateSupportInfo: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const data = await supportInfoService.updateSupportInfo(id, req.body);
      res.status(200).json({ success: true, data, message: 'Support info updated successfully' });
    } catch (error: any) {
      console.error('Error updating support info:', error);
      res.status(500).json({ success: false, message: 'Failed to update support info' });
    }
  },

  deleteSupportInfo: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await supportInfoService.deleteSupportInfo(id);
      res.status(200).json({ success: true, message: 'Support info deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting support info:', error);
      res.status(500).json({ success: false, message: 'Failed to delete support info' });
    }
  }
};
