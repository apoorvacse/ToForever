/**
 * Watch Together Signaling Server
 * Entry point for WebRTC signaling backend
 */

import { Server } from 'socket.io';
import { createHTTPServer } from './server.js';
import { setupSocketHandlers } from './socket.js';
import RoomManager from './roomManager.js';
import { logger } from './logger.js';

// Configuration
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize room manager
const roomManager = new RoomManager();

// Create HTTP server
const { app, httpServer } = createHTTPServer();

// Initialize Socket.IO with CORS configuration
const allowedOrigins = FRONTEND_URL.split(',').map(url => url.trim());
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin in development
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  // Production optimizations
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Setup socket event handlers
setupSocketHandlers(io, roomManager);

app.get('/', (req, res) => {
  res.send('Watch Together - Signaling Server');
});

// Start server
httpServer.listen(PORT, () => {
  logger.info('╔═══════════════════════════════════════════════════════╗');
  logger.info('║   Watch Together - Signaling Server                   ║');
  logger.info('╠═══════════════════════════════════════════════════════╣');
  logger.info(`║   Server running on port: ${PORT.toString().padEnd(35)}║`);
  logger.info(`║   Frontend URL: ${FRONTEND_URL.padEnd(38)}║`);
  logger.info(`║   Socket.IO ready for connections                    ║`);
  logger.info('╚═══════════════════════════════════════════════════════╝');
  logger.info('');
  logger.info('📡 Waiting for WebRTC signaling connections...');
  logger.info('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('\n[SERVER] SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('[SERVER] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('\n[SERVER] SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('[SERVER] HTTP server closed');
    process.exit(0);
  });
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('[SERVER] Uncaught Exception:', error);
  process.exit(1);
});

