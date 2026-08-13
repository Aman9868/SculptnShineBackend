import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Require authentication for all support routes
router.use(authenticate);

// --- User Routes ---
// POST /api/support/tickets
router.post('/tickets', ticketController.createTicket);

// GET /api/support/tickets/my-tickets
router.get('/tickets/my-tickets', ticketController.getMyTickets);

// GET /api/support/tickets/:id
router.get('/tickets/:id', ticketController.getTicketDetails);

// POST /api/support/tickets/:id/reply
router.post('/tickets/:id/reply', ticketController.addReply);


// --- Admin Routes ---
// GET /api/support/admin/tickets
router.get('/admin/tickets', authorizeRoles('ADMIN'), ticketController.getAllTicketsAdmin);

// PATCH /api/support/admin/tickets/:id/status
router.patch('/admin/tickets/:id/status', authorizeRoles('ADMIN'), ticketController.updateTicketStatus);

export default router;
