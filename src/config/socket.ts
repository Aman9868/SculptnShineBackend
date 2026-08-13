import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.IO] Client connected: ${socket.id}`);

    // User joins room for a specific order to receive live status updates
    socket.on('join_order_room', (orderId: string) => {
      if (orderId) {
        socket.join(`order_${orderId}`);
        console.log(`📡 [Socket.IO] Socket ${socket.id} joined room: order_${orderId}`);
      }
    });

    // Admin joins admin room for live order notifications
    socket.on('join_admin_room', () => {
      socket.join('admin_orders');
      console.log(`🛡️ [Socket.IO] Socket ${socket.id} joined room: admin_orders`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ [Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};

export const emitOrderStatusUpdate = (orderId: string, payload: any) => {
  if (io) {
    io.to(`order_${orderId}`).emit('order_status_updated', payload);
    io.to('admin_orders').emit('admin_order_updated', payload);
  }
};

export const emitNewOrderToAdmin = (payload: any) => {
  if (io) {
    io.to('admin_orders').emit('admin_new_order', payload);
  }
};
