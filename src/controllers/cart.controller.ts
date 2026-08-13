import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cart.service';

export class CartController {
  static async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const cart = await CartService.getCart(userId);
      res.status(200).json({
        success: true,
        message: 'Cart fetched successfully',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addToCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { productId, variantId, quantity } = req.body;
      const cart = await CartService.addToCart(userId, productId, variantId, quantity);
      res.status(200).json({
        success: true,
        message: 'Item added to cart',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCartItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { quantity } = req.body;
      const cart = await CartService.updateCartItem(userId, req.params.id as string, quantity);
      res.status(200).json({
        success: true,
        message: 'Cart item updated',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeFromCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const cart = await CartService.removeFromCart(userId, req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  static async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await CartService.clearCart(userId);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
