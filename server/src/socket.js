/**
 * Socket.IO Event Handlers
 * Handles all WebRTC signaling events
 */

export function setupSocketHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Track which room this socket is in
    let currentRoomId = null;

    /**
     * Join Room Event
     * Client emits: { roomId, userId, name? }
     * Server responds: 'peer-joined' to other users, 'room-joined' to client
     */
    socket.on('join-room', ({ roomId, userId, name }) => {
      try {
        if (!roomId || !userId) {
          socket.emit('error', { message: 'Missing roomId or userId' });
          return;
        }

        // Leave previous room if any
        if (currentRoomId && currentRoomId !== roomId) {
          handleLeaveRoom(socket, currentRoomId);
        }

        // Create room if it doesn't exist
        if (!roomManager.getRoom(roomId)) {
          roomManager.createRoom(roomId);
        }

        // Add user to room
        const result = roomManager.addUser(roomId, socket.id, { userId, name });

        if (!result.success) {
          socket.emit('error', { message: result.error });
          return;
        }

        currentRoomId = roomId;
        socket.join(roomId);

        const otherUsers = roomManager.getOtherUsers(roomId, socket.id);
        
        // Notify client they joined successfully
        socket.emit('room-joined', {
          roomId,
          userId,
          isHost: result.isHost,
          otherUsers: otherUsers.map(u => ({ userId: u.userId, name: u.name })),
        });

        // Notify other users that a peer joined
        if (otherUsers.length > 0) {
          socket.to(roomId).emit('peer-joined', {
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

        console.log(`[Socket] ${socket.id} joined room ${roomId} as ${userId}`);
      } catch (error) {
        console.error(`[Socket] Error in join-room:`, error);
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
        if (!offer || !roomId) {
          socket.emit('error', { message: 'Missing offer or roomId' });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room || !room.users.has(socket.id)) {
          socket.emit('error', { message: 'Not in room' });
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
          socket.to(roomId).emit('offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: room.users.get(socket.id)?.userId,
          });
        }

        console.log(`[Socket] Offer relayed from ${socket.id} in room ${roomId}`);
      } catch (error) {
        console.error(`[Socket] Error in offer:`, error);
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
        if (!answer || !roomId || !targetSocketId) {
          socket.emit('error', { message: 'Missing answer, roomId, or targetSocketId' });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room || !room.users.has(socket.id)) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        socket.to(targetSocketId).emit('answer', {
          answer,
          fromSocketId: socket.id,
          fromUserId: room.users.get(socket.id)?.userId,
        });

        console.log(`[Socket] Answer relayed from ${socket.id} to ${targetSocketId}`);
      } catch (error) {
        console.error(`[Socket] Error in answer:`, error);
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
        if (!candidate || !roomId) {
          return; // ICE candidates can be null, silently ignore
        }

        const room = roomManager.getRoom(roomId);
        if (!room || !room.users.has(socket.id)) {
          return; // Silently ignore if not in room
        }

        // If targetSocketId specified, send to that specific user
        // Otherwise, send to all other users in room
        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice-candidate', {
            candidate,
            fromSocketId: socket.id,
          });
        } else {
          socket.to(roomId).emit('ice-candidate', {
            candidate,
            fromSocketId: socket.id,
          });
        }
      } catch (error) {
        console.error(`[Socket] Error in ice-candidate:`, error);
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
        if (!roomId) {
          socket.emit('error', { message: 'Missing roomId' });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room || !room.users.has(socket.id)) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        const success = roomManager.setHost(roomId, socket.id);
        if (success) {
          const newHost = room.users.get(socket.id);
          // Notify all users in room about host change
          io.to(roomId).emit('host-changed', {
            hostId: newHost.userId,
            hostName: newHost.name,
            socketId: socket.id,
          });

          console.log(`[Socket] Host changed in room ${roomId} to ${newHost.userId}`);
        }
      } catch (error) {
        console.error(`[Socket] Error in host-changed:`, error);
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
      console.log(`[Socket] Client disconnected: ${socket.id}`);
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

        console.log(`[Socket] ${socket.id} left room ${roomId}`);
      }
    }
  });

  // Periodic cleanup of stale rooms
  setInterval(() => {
    roomManager.cleanup();
  }, 60 * 60 * 1000); // Every hour
}

