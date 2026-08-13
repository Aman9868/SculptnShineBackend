import http from 'http';
import app from './app';
import dotenv from 'dotenv';
import { prisma } from './config/prisma';
import { initSocket } from './config/socket';

dotenv.config();

const PORT = process.env.PORT || 5000;
export { prisma };

const startServer = async () => {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');

    const server = http.createServer(app);
    initSocket(server);

    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`⚡ Real-time Socket.IO server initialized`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

