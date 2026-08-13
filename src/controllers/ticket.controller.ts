import { Request, Response } from 'express';
import { ticketService } from '../services/ticket.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ticketController = {
  // User Routes
  createTicket: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User profile not found' });
      }

      const ticket = await ticketService.createTicket(profile.id, req.body);
      return res.status(201).json({ success: true, data: ticket });
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create ticket' });
    }
  },

  getMyTickets: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      if (!profile) {
        return res.status(200).json({ success: true, data: [] });
      }

      const tickets = await ticketService.getUserTickets(profile.id);
      return res.status(200).json({ success: true, data: tickets });
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
    }
  },

  getTicketDetails: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const isAdmin = req.user?.role === 'ADMIN';
      const userId = req.user?.userId;

      if (!userId) {
         return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let userProfileId = undefined;
      if (!isAdmin) {
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
        userProfileId = profile.id;
      }

      const ticket = await ticketService.getTicketById(id, userProfileId);
      
      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found or unauthorized' });
      }

      return res.status(200).json({ success: true, data: ticket });
    } catch (error: any) {
      console.error('Error fetching ticket details:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ticket details' });
    }
  },

  addReply: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { message, attachments } = req.body;
      const isAdmin = req.user?.role === 'ADMIN';
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      let senderId = userId;
      let userProfileId = undefined;

      if (!isAdmin) {
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
        senderId = profile.id;
        userProfileId = profile.id;
      }

      const senderType = isAdmin ? 'ADMIN' : 'USER';

      // First verify access
      const ticket = await ticketService.getTicketById(id, userProfileId);
      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found or unauthorized' });
      }

      const reply = await ticketService.addMessage(id, senderType, senderId, message, attachments);
      return res.status(201).json({ success: true, data: reply });
    } catch (error: any) {
      console.error('Error adding reply:', error);
      return res.status(500).json({ success: false, message: 'Failed to add reply' });
    }
  },

  // Admin Routes
  getAllTicketsAdmin: async (req: Request, res: Response) => {
    try {
      const { status, category, search } = req.query;
      
      const tickets = await ticketService.getAllTicketsAdmin({
        status: status as any,
        category: category as any,
        search: search as string
      });

      return res.status(200).json({ success: true, data: tickets });
    } catch (error: any) {
      console.error('Error fetching all tickets:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
    }
  },

  updateTicketStatus: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status, adminResponse } = req.body;
      
      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const ticket = await ticketService.updateTicketStatus(id, status, adminResponse);
      return res.status(200).json({ success: true, data: ticket });
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      return res.status(500).json({ success: false, message: 'Failed to update ticket status' });
    }
  }
};
