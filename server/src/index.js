/**
 * Watch Together Signaling Server
 * Entry point for WebRTC signaling backend
 */

import { Server } from 'socket.io';
import { createHTTPServer } from './server.js';
import { setupSocketHandlers } from './socket.js';
import RoomManager from './roomManager.js';

// Configuration
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize room manager
const roomManager = new RoomManager();

// Create HTTP server
const { app, httpServer } = createHTTPServer();

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Setup socket event handlers
setupSocketHandlers(io, roomManager);

// Start server
httpServer.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Watch Together - Signaling Server                   ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║   Server running on port: ${PORT.toString().padEnd(35)}║`);
  console.log(`║   Frontend URL: ${FRONTEND_URL.padEnd(38)}║`);
  console.log(`║   Socket.IO ready for connections                    ║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📡 Waiting for WebRTC signaling connections...');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[SERVER] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SERVER] SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[SERVER] HTTP server closed');
    process.exit(0);
  });
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
  process.exit(1);
});

