import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/store/roomStore';
import { logger } from '@/lib/logger';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://toforever.onrender.com';

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
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());

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

    socket.on('disconnect', (reason) => {
      logger.log('[Socket] Disconnected:', reason);
      setConnectionStatus('disconnected');
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - might be intentional
        logger.warn('[Socket] Server disconnected the client');
      } else if (reason === 'io client disconnect') {
        // Client initiated disconnect - normal
        logger.log('[Socket] Client disconnected');
      } else {
        // Network issues or transport errors
        logger.warn('[Socket] Unexpected disconnect:', reason);
      }
    });

    socket.on('connect_error', (error) => {
      logger.error('[Socket] Connection error:', error);
      setConnectionStatus('disconnected');
      
      // Provide user feedback for connection errors
      if (optionsRef.current.onError) {
        optionsRef.current.onError({
          message: `Connection failed: ${error.message || 'Unable to connect to server'}`,
        });
      }
    });
    
    socket.on('reconnect', (attemptNumber) => {
      logger.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connecting');
    });
    
    socket.on('reconnect_error', (error) => {
      logger.error('[Socket] Reconnection error:', error);
    });
    
    socket.on('reconnect_failed', () => {
      logger.error('[Socket] Reconnection failed after all attempts');
      setConnectionStatus('disconnected');
      if (optionsRef.current.onError) {
        optionsRef.current.onError({
          message: 'Connection lost. Please refresh the page.',
        });
      }
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
        const timeout = setTimeout(() => {
          timeoutRefs.current.delete(timeout);
          optionsRef.current.onCreateOffer?.({
            targetSocketId: '', // Will be set by server
            targetUserId: data.otherUsers[0].userId,
          });
        }, 1000);
        timeoutRefs.current.add(timeout);
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
      // Cleanup all timeouts
      timeoutRefs.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      timeoutRefs.current.clear();
      
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

