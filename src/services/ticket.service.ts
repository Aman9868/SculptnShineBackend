import { PrismaClient, TicketStatus, TicketPriority, TicketCategory, SenderType } from '@prisma/client';

const prisma = new PrismaClient();

// Utility to generate unique ticket numbers (e.g. TKT-10045)
async function generateTicketNumber(): Promise<string> {
  const lastTicket = await prisma.supportTicket.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  
  if (!lastTicket || !lastTicket.ticketNumber.startsWith('TKT-')) {
    return 'TKT-10001';
  }
  
  const lastNumberStr = lastTicket.ticketNumber.replace('TKT-', '');
  const lastNumber = parseInt(lastNumberStr, 10);
  
  if (isNaN(lastNumber)) {
    return `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  
  return `TKT-${lastNumber + 1}`;
}

export const ticketService = {
  createTicket: async (
    userProfileId: string, 
    data: {
      subject: string;
      description: string;
      category: TicketCategory;
      priority?: TicketPriority;
      orderId?: string;
      productId?: string;
      attachments?: string[];
    }
  ) => {
    const ticketNumber = await generateTicketNumber();
    
    return prisma.supportTicket.create({
      data: {
        ticketNumber,
        userProfileId,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'MEDIUM',
        orderId: data.orderId || null,
        productId: data.productId || null,
        attachments: data.attachments || [],
        status: 'OPEN',
      }
    });
  },

  getUserTickets: async (userProfileId: string) => {
    return prisma.supportTicket.findMany({
      where: { userProfileId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNumber: true } },
        product: { select: { title: true, images: true } }
      }
    });
  },

  getTicketById: async (id: string, userProfileId?: string) => {
    const whereClause: any = { id };
    
    // If userProfileId is provided, restrict access to only that user's tickets (for frontend)
    if (userProfileId) {
      whereClause.userProfileId = userProfileId;
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: whereClause,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        order: {
          select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true }
        },
        product: {
          select: { id: true, title: true, images: true, slug: true }
        },
        userProfile: {
          select: { 
            id: true,
            user: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });
    
    return ticket;
  },

  getAllTicketsAdmin: async (filters?: { status?: TicketStatus, category?: TicketCategory, search?: string }) => {
    let whereClause: any = {};
    
    if (filters?.status) whereClause.status = filters.status;
    if (filters?.category) whereClause.category = filters.category;
    if (filters?.search) {
      whereClause.OR = [
        { ticketNumber: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { userProfile: { user: { email: { contains: filters.search, mode: 'insensitive' } } } }
      ];
    }

    return prisma.supportTicket.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        userProfile: {
          select: { user: { select: { firstName: true, lastName: true, email: true } } }
        }
      }
    });
  },

  updateTicketStatus: async (id: string, status: TicketStatus, adminResponse?: string) => {
    return prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        ...(adminResponse ? { adminResponse } : {}),
        ...(status === 'RESOLVED' || status === 'CLOSED' ? { resolvedAt: new Date() } : {})
      }
    });
  },

  addMessage: async (
    ticketId: string, 
    senderType: SenderType, 
    senderId: string, 
    message: string, 
    attachments?: string[]
  ) => {
    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderType,
        senderId,
        message,
        attachments: attachments || []
      }
    });
    
    // Auto-update ticket status to IN_PROGRESS if an admin replies and it was OPEN
    if (senderType === 'ADMIN') {
      const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
      if (ticket && ticket.status === 'OPEN') {
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { status: 'IN_PROGRESS' }
        });
      }
    }
    
    return ticketMessage;
  }
};
