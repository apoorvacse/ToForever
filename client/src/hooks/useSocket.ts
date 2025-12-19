import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/store/roomStore';
import { logger } from '@/lib/logger';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

interface UseSocketOptions {
  roomId: string | null;
  userId: string;
  userName?: string;
  onPeerJoined?: (data: { userId: string; name: string; socketId: string }) => void;
  onPeerLeft?: (data: { userId: string; socketId: string }) => void;
  onOffer?: (data: { offer: RTCSessionDescriptionInit; fromSocketId: string; fromUserId: string }) => void;
  onAnswer?: (data: { answer: RTCSessionDescriptionInit; fromSocketId: string; fromUserId: string }) => void;
  onIceCandidate?: (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => void;
  onHostChanged?: (data: { hostId: string; hostName: string; socketId: string }) => void;
  onCreateOffer?: (data: { targetSocketId: string; targetUserId: string }) => void;
  onError?: (data: { message: string }) => void;
}

export const useSocket = (options: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const { setConnectionStatus, setHostId, setRemoteUser } = useRoomStore();
  const optionsRef = useRef(options);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize socket connection
  useEffect(() => {
    if (!options.roomId || !options.userId || options.userId === '') {
      return;
    }

    // Clean up existing socket if any
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: true,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      logger.log('[Socket] Connected:', socket.id);
      setConnectionStatus('connecting');

      // Join room after connection
      socket.emit('join-room', {
        roomId: options.roomId,
        userId: options.userId,
        name: options.userName,
      });
    });

    socket.on('disconnect', () => {
      logger.log('[Socket] Disconnected');
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      logger.error('[Socket] Connection error:', error);
      setConnectionStatus('disconnected');
    });

    // Room events
    socket.on('room-joined', (data) => {
      logger.log('[Socket] Room joined:', data);
      setConnectionStatus('connected');
      if (data.isHost) {
        setHostId(options.userId);
      }
      // If there are other users already in the room, we should create an offer
      if (data.otherUsers && data.otherUsers.length > 0) {
        // The server will send create-offer event, but we can also trigger it here
        setTimeout(() => {
          optionsRef.current.onCreateOffer?.({
            targetSocketId: '', // Will be set by server
            targetUserId: data.otherUsers[0].userId,
          });
        }, 1000);
      }
    });

    socket.on('peer-joined', (data) => {
      logger.log('[Socket] Peer joined:', data);
      optionsRef.current.onPeerJoined?.(data);
    });

    socket.on('peer-left', (data) => {
      logger.log('[Socket] Peer left:', data);
      optionsRef.current.onPeerLeft?.(data);
      setRemoteUser(null);
      setHostId(null);
    });

    socket.on('create-offer', (data) => {
      logger.log('[Socket] Create offer requested:', data);
      optionsRef.current.onCreateOffer?.(data);
    });

    // WebRTC signaling events
    socket.on('offer', (data) => {
      logger.log('[Socket] Received offer:', data);
      optionsRef.current.onOffer?.(data);
    });

    socket.on('answer', (data) => {
      logger.log('[Socket] Received answer:', data);
      optionsRef.current.onAnswer?.(data);
    });

    socket.on('ice-candidate', (data) => {
      logger.log('[Socket] Received ICE candidate:', data);
      optionsRef.current.onIceCandidate?.(data);
    });

    socket.on('host-changed', (data) => {
      logger.log('[Socket] Host changed:', data);
      setHostId(data.hostId);
      optionsRef.current.onHostChanged?.(data);
    });

    socket.on('error', (data) => {
      logger.error('[Socket] Error:', data);
      // Show user-friendly error message
      if (data.message) {
        // Error will be handled by Room component via toast
        optionsRef.current.onError?.(data);
      }
    });

    // Cleanup on unmount or when roomId/userId changes
    return () => {
      if (socket && socket.connected) {
        try {
          socket.emit('leave-room');
        } catch (e) {
          // Ignore errors during cleanup
          logger.warn('[Socket] Error during cleanup:', e);
        }
      }
      if (socket) {
        socket.removeAllListeners(); // Remove all listeners first
        socket.disconnect(); // Then disconnect
      }
      socketRef.current = null;
    };
  }, [options.roomId, options.userId]); // Only depend on roomId and userId

  // Emit functions
  const emitOffer = useCallback((offer: RTCSessionDescriptionInit, targetSocketId?: string) => {
    if (socketRef.current?.connected && options.roomId) {
      socketRef.current.emit('offer', {
        offer,
        roomId: options.roomId,
        targetSocketId,
      });
    }
  }, [options.roomId]);

  const emitAnswer = useCallback((answer: RTCSessionDescriptionInit, targetSocketId: string) => {
    if (socketRef.current?.connected && options.roomId) {
      socketRef.current.emit('answer', {
        answer,
        roomId: options.roomId,
        targetSocketId,
      });
    }
  }, [options.roomId]);

  const emitIceCandidate = useCallback((candidate: RTCIceCandidateInit, targetSocketId?: string) => {
    if (socketRef.current?.connected && options.roomId) {
      socketRef.current.emit('ice-candidate', {
        candidate,
        roomId: options.roomId,
        targetSocketId,
      });
    }
  }, [options.roomId]);

  const emitHostChanged = useCallback(() => {
    if (socketRef.current?.connected && options.roomId) {
      socketRef.current.emit('host-changed', {
        roomId: options.roomId,
      });
    }
  }, [options.roomId]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
    emitOffer,
    emitAnswer,
    emitIceCandidate,
    emitHostChanged,
  };
};

