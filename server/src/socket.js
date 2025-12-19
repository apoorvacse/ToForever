/**
 * Socket.IO Event Handlers
 * Handles all WebRTC signaling events
 */

import { logger } from './logger.js';

// Input validation helpers
function validateRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') return false;
  // Room ID should be alphanumeric, 4-20 characters
  return /^[A-Z0-9]{4,20}$/i.test(roomId.trim());
}

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  // User ID should be alphanumeric, 3-50 characters
  return /^[a-zA-Z0-9]{3,50}$/.test(userId.trim());
}

function sanitizeString(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength).replace(/[<>]/g, '');
}

export function setupSocketHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    logger.log(`[Socket] Client connected: ${socket.id}`);

    // Track which room this socket is in
    let currentRoomId = null;

    /**
     * Join Room Event
     * Client emits: { roomId, userId, name? }
     * Server responds: 'peer-joined' to other users, 'room-joined' to client
     */
    socket.on('join-room', ({ roomId, userId, name }) => {
      try {
        // Input validation
        if (!validateRoomId(roomId)) {
          socket.emit('error', { message: 'Invalid roomId format' });
          return;
        }
        
        if (!validateUserId(userId)) {
          socket.emit('error', { message: 'Invalid userId format' });
          return;
        }

        // Sanitize name if provided
        const sanitizedName = name ? sanitizeString(name, 50) : undefined;

        // Leave previous room if any
        if (currentRoomId && currentRoomId !== roomId) {
          handleLeaveRoom(socket, currentRoomId);
        }

        // Create room if it doesn't exist
        if (!roomManager.getRoom(roomId)) {
          roomManager.createRoom(roomId);
        }

        // Add user to room
        const result = roomManager.addUser(roomId.trim().toUpperCase(), socket.id, { 
          userId: userId.trim(), 
          name: sanitizedName 
        });

        if (!result.success) {
          socket.emit('error', { message: result.error });
          return;
        }

        currentRoomId = roomId.trim().toUpperCase();
        socket.join(currentRoomId);

        const otherUsers = roomManager.getOtherUsers(currentRoomId, socket.id);
        
        // Notify client they joined successfully
        socket.emit('room-joined', {
          roomId: currentRoomId,
          userId: result.user.userId,
          isHost: result.isHost,
          otherUsers: otherUsers.map(u => ({ userId: u.userId, name: u.name })),
        });

        // Notify other users that a peer joined
        if (otherUsers.length > 0) {
          socket.to(currentRoomId).emit('peer-joined', {
            userId: result.user.userId,
            name: result.user.name,
            socketId: socket.id,
          });

          // If there's already a peer, trigger offer creation
          // The existing peer should create an offer for the new user
          const existingPeer = otherUsers[0];
          io.to(existingPeer.socketId).emit('create-offer', {
            targetSocketId: socket.id,
            targetUserId: result.user.userId,
          });
        }

        logger.log(`[Socket] ${socket.id} joined room ${currentRoomId} as ${result.user.userId}`);
      } catch (error) {
        logger.error(`[Socket] Error in join-room:`, error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * WebRTC Offer Event
     * Client emits: { offer, roomId, targetSocketId? }
     * Server relays to: Other user(s) in room
     */
    socket.on('offer', ({ offer, roomId, targetSocketId }) => {
      try {
        // Input validation
        if (!offer || typeof offer !== 'object' || !offer.type || !offer.sdp) {
          socket.emit('error', { message: 'Invalid offer format' });
          return;
        }
        
        if (!validateRoomId(roomId)) {
          socket.emit('error', { message: 'Invalid roomId format' });
          return;
        }

        const normalizedRoomId = roomId.trim().toUpperCase();
        const room = roomManager.getRoom(normalizedRoomId);
        if (!room || !room.users.has(socket.id)) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        // Validate targetSocketId if provided
        if (targetSocketId && typeof targetSocketId !== 'string') {
          socket.emit('error', { message: 'Invalid targetSocketId' });
          return;
        }

        // If targetSocketId specified, send to that specific user
        // Otherwise, send to all other users in room
        if (targetSocketId) {
          socket.to(targetSocketId).emit('offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: room.users.get(socket.id)?.userId,
          });
        } else {
          socket.to(normalizedRoomId).emit('offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: room.users.get(socket.id)?.userId,
          });
        }

        logger.log(`[Socket] Offer relayed from ${socket.id} in room ${normalizedRoomId}`);
      } catch (error) {
        logger.error(`[Socket] Error in offer:`, error);
        socket.emit('error', { message: 'Failed to relay offer' });
      }
    });

    /**
     * WebRTC Answer Event
     * Client emits: { answer, roomId, targetSocketId }
     * Server relays to: Specific target user
     */
    socket.on('answer', ({ answer, roomId, targetSocketId }) => {
      try {
        // Input validation
        if (!answer || typeof answer !== 'object' || !answer.type || !answer.sdp) {
          socket.emit('error', { message: 'Invalid answer format' });
          return;
        }
        
        if (!validateRoomId(roomId)) {
          socket.emit('error', { message: 'Invalid roomId format' });
          return;
        }
        
        if (!targetSocketId || typeof targetSocketId !== 'string') {
          socket.emit('error', { message: 'Invalid targetSocketId' });
          return;
        }

        const normalizedRoomId = roomId.trim().toUpperCase();
        const room = roomManager.getRoom(normalizedRoomId);
        if (!room || !room.users.has(socket.id)) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        socket.to(targetSocketId).emit('answer', {
          answer,
          fromSocketId: socket.id,
          fromUserId: room.users.get(socket.id)?.userId,
        });

        logger.log(`[Socket] Answer relayed from ${socket.id} to ${targetSocketId}`);
      } catch (error) {
        logger.error(`[Socket] Error in answer:`, error);
        socket.emit('error', { message: 'Failed to relay answer' });
      }
    });

    /**
     * ICE Candidate Event
     * Client emits: { candidate, roomId, targetSocketId? }
     * Server relays to: Other user(s) in room
     */
    socket.on('ice-candidate', ({ candidate, roomId, targetSocketId }) => {
      try {
        // ICE candidates can be null, silently ignore
        if (!candidate || !roomId) {
          return;
        }

        // Validate roomId format
        if (!validateRoomId(roomId)) {
          return; // Silently ignore invalid room IDs for ICE candidates
        }

        const normalizedRoomId = roomId.trim().toUpperCase();
        const room = roomManager.getRoom(normalizedRoomId);
        if (!room || !room.users.has(socket.id)) {
          return; // Silently ignore if not in room
        }

        // Validate candidate format
        if (typeof candidate !== 'object' || !candidate.candidate) {
          return; // Silently ignore invalid candidates
        }

        // Validate targetSocketId if provided
        if (targetSocketId && typeof targetSocketId !== 'string') {
          return; // Silently ignore invalid targetSocketId
        }

        // If targetSocketId specified, send to that specific user
        // Otherwise, send to all other users in room
        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice-candidate', {
            candidate,
            fromSocketId: socket.id,
          });
        } else {
          socket.to(normalizedRoomId).emit('ice-candidate', {
            candidate,
            fromSocketId: socket.id,
          });
        }
      } catch (error) {
        logger.error(`[Socket] Error in ice-candidate:`, error);
        // Silently ignore ICE candidate errors
      }
    });

    /**
     * Host Changed Event
     * Client emits: { roomId } when starting/stopping screen share
     * Server updates host and notifies all users
     */
    socket.on('host-changed', ({ roomId }) => {
      try {
        // Input validation
        if (!validateRoomId(roomId)) {
          socket.emit('error', { message: 'Invalid roomId format' });
          return;
        }

        const normalizedRoomId = roomId.trim().toUpperCase();
        const room = roomManager.getRoom(normalizedRoomId);
        if (!room || !room.users.has(socket.id)) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        const success = roomManager.setHost(normalizedRoomId, socket.id);
        if (success) {
          const newHost = room.users.get(socket.id);
          // Notify all users in room about host change
          io.to(normalizedRoomId).emit('host-changed', {
            hostId: newHost.userId,
            hostName: newHost.name,
            socketId: socket.id,
          });

          logger.log(`[Socket] Host changed in room ${normalizedRoomId} to ${newHost.userId}`);
        }
      } catch (error) {
        logger.error(`[Socket] Error in host-changed:`, error);
        socket.emit('error', { message: 'Failed to update host' });
      }
    });

    /**
     * Leave Room Event
     * Client can explicitly leave room
     */
    socket.on('leave-room', () => {
      if (currentRoomId) {
        handleLeaveRoom(socket, currentRoomId);
        currentRoomId = null;
      }
    });

    /**
     * Disconnect Handler
     * Clean up when client disconnects
     */
    socket.on('disconnect', () => {
      logger.log(`[Socket] Client disconnected: ${socket.id}`);
      if (currentRoomId) {
        handleLeaveRoom(socket, currentRoomId);
      }
    });

    /**
     * Helper function to handle leaving a room
     */
    function handleLeaveRoom(socket, roomId) {
      const result = roomManager.removeUser(roomId, socket.id);
      
      if (result.success) {
        socket.leave(roomId);
        
        // Notify other users that peer left
        socket.to(roomId).emit('peer-left', {
          userId: result.user.userId,
          socketId: socket.id,
        });

        // If host changed, notify about new host
        if (result.wasHost && result.newHostId) {
          const newHost = roomManager.getUser(roomId, result.newHostId);
          if (newHost) {
            io.to(roomId).emit('host-changed', {
              hostId: newHost.userId,
              hostName: newHost.name,
              socketId: result.newHostId,
            });
          }
        }

        logger.log(`[Socket] ${socket.id} left room ${roomId}`);
      }
    }
  });

  // Periodic cleanup of stale rooms
  setInterval(() => {
    roomManager.cleanup();
  }, 60 * 60 * 1000); // Every hour
}

