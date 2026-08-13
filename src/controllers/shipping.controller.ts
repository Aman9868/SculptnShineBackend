import { Request, Response } from 'express';
import { ShippingService } from '../services/shipping.service';

export const shippingController = {
  async getSettings(req: Request, res: Response) {
    try {
      const rules = await ShippingService.getShippingRules();
      const settings = await ShippingService.getStoreSettings();

      res.status(200).json({
        success: true,
        data: {
          rules,
          threshold: settings.FREE_SHIPPING_THRESHOLD,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async calculateShipping(req: Request, res: Response) {
    try {
      const { state, subtotal } = req.body;
      
      if (!state || subtotal === undefined) {
        return res.status(400).json({ success: false, message: 'State and subtotal are required' });
      }

      const calculation = await ShippingService.calculateShipping(state, Number(subtotal));

      res.status(200).json({
        success: true,
        data: calculation,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createRule(req: Request, res: Response) {
    try {
      const { name, states, charge, isDefault } = req.body;

      if (!name || charge === undefined) {
        return res.status(400).json({ success: false, message: 'Name and charge are required' });
      }

      const rule = await ShippingService.createShippingRule({ name, states: states || [], charge: Number(charge), isDefault });

      res.status(201).json({
        success: true,
        message: 'Shipping rule created successfully',
        data: rule,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
         return res.status(400).json({ success: false, message: 'Rule name already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      if (data.charge !== undefined) data.charge = Number(data.charge);

      const rule = await ShippingService.updateShippingRule(id as string, data);

      res.status(200).json({
        success: true,
        message: 'Shipping rule updated successfully',
        data: rule,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
         return res.status(400).json({ success: false, message: 'Rule name already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await ShippingService.deleteShippingRule(id as string);

      res.status(200).json({
        success: true,
        message: 'Shipping rule deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateThreshold(req: Request, res: Response) {
    try {
      const { threshold } = req.body;

      if (threshold === undefined) {
        return res.status(400).json({ success: false, message: 'Threshold is required' });
      }

      const setting = await ShippingService.updateFreeShippingThreshold(Number(threshold));

      res.status(200).json({
        success: true,
        message: 'Free shipping threshold updated successfully',
        data: {
          FREE_SHIPPING_THRESHOLD: parseFloat(setting.value)
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
