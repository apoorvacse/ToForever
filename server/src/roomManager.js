/**
 * Room Manager
 * Manages in-memory room state and user tracking
 * Each room supports maximum 2 users
 */

import { logger } from './logger.js';

class RoomManager {
  constructor() {
    // Map<roomId, Room>
    this.rooms = new Map();
  }

  /**
   * Create a new room
   * @param {string} roomId - Room identifier
   * @returns {Room} Created room object
   */
  createRoom(roomId) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    const room = {
      id: roomId,
      users: new Map(), // Map<socketId, User>
      hostId: null, // socketId of current host
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    logger.log(`[RoomManager] Room created: ${roomId}`);
    return room;
  }

  /**
   * Get room by ID
   * @param {string} roomId - Room identifier
   * @returns {Room|null} Room object or null if not found
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Add user to room
   * @param {string} roomId - Room identifier
   * @param {string} socketId - Socket connection ID
   * @param {object} userData - User metadata (userId, name, etc.)
   * @returns {object} Result object with success status and room info
   */
  addUser(roomId, socketId, userData) {
    const room = this.getRoom(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Check if room is full (max 2 users)
    if (room.users.size >= 2) {
      return { success: false, error: 'Room is full' };
    }

    // Check if user already in room
    if (room.users.has(socketId)) {
      return { success: false, error: 'User already in room' };
    }

    // Add user to room
    const user = {
      socketId,
      userId: userData.userId,
      name: userData.name || `User ${userData.userId.substring(0, 4)}`,
      joinedAt: Date.now(),
    };

    room.users.set(socketId, user);

    // Set first user as host if no host exists
    if (!room.hostId && room.users.size === 1) {
      room.hostId = socketId;
    }

    logger.log(`[RoomManager] User ${user.userId} joined room ${roomId} (${room.users.size}/2)`);
    
    return {
      success: true,
      room,
      user,
      isHost: room.hostId === socketId,
    };
  }

  /**
   * Remove user from room
   * @param {string} roomId - Room identifier
   * @param {string} socketId - Socket connection ID
   * @returns {object} Result object with room info and new host
   */
  removeUser(roomId, socketId) {
    const room = this.getRoom(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const user = room.users.get(socketId);
    if (!user) {
      return { success: false, error: 'User not in room' };
    }

    const wasHost = room.hostId === socketId;
    room.users.delete(socketId);

    // If host left, assign new host (first remaining user)
    let newHostId = null;
    if (wasHost && room.users.size > 0) {
      newHostId = Array.from(room.users.keys())[0];
      room.hostId = newHostId;
    } else if (room.users.size === 0) {
      room.hostId = null;
    }

    // Clean up empty rooms
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      logger.log(`[RoomManager] Room deleted: ${roomId}`);
    } else {
      logger.log(`[RoomManager] User ${user.userId} left room ${roomId} (${room.users.size}/2)`);
    }

    return {
      success: true,
      room,
      user,
      wasHost,
      newHostId,
    };
  }

  /**
   * Get other users in the room (excluding the specified socket)
   * @param {string} roomId - Room identifier
   * @param {string} socketId - Socket ID to exclude
   * @returns {Array} Array of user objects
   */
  getOtherUsers(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room) return [];

    return Array.from(room.users.values()).filter(
      (user) => user.socketId !== socketId
    );
  }

  /**
   * Set host for a room
   * @param {string} roomId - Room identifier
   * @param {string} socketId - Socket ID of new host
   * @returns {boolean} Success status
   */
  setHost(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    if (!room.users.has(socketId)) {
      return false;
    }

    const oldHostId = room.hostId;
    room.hostId = socketId;

    logger.log(`[RoomManager] Host changed in room ${roomId}: ${oldHostId} -> ${socketId}`);
    return true;
  }

  /**
   * Get user by socket ID
   * @param {string} roomId - Room identifier
   * @param {string} socketId - Socket connection ID
   * @returns {object|null} User object or null
   */
  getUser(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    return room.users.get(socketId) || null;
  }

  /**
   * Get all rooms (for debugging)
   * @returns {Array} Array of room objects
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  /**
   * Clean up rooms (remove empty rooms older than 1 hour)
   */
  cleanup() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.size === 0 && (now - room.createdAt) > oneHour) {
        this.rooms.delete(roomId);
        logger.log(`[RoomManager] Cleaned up stale room: ${roomId}`);
      }
    }
  }
}

export default RoomManager;

