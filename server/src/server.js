/**
 * Express Server Setup
 * HTTP server for Socket.IO
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';

export function createHTTPServer() {
  const app = express();

  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'watch-together-signaling-server'
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return { app, httpServer };
}

