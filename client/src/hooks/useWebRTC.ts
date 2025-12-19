import { useCallback, useRef } from 'react';
import { useRoomStore } from '@/store/roomStore';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseWebRTCOptions {
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit) => void;
}

export const useWebRTC = (options?: UseWebRTCOptions) => {
  const { setConnectionStatus, setRemoteStream, setRemoteUser } = useRoomStore();
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const targetSocketIdRef = useRef<string | null>(null);

  const initializePeerConnection = useCallback((localStream: MediaStream) => {
    // Clean up existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Add local tracks to connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams[0]) {
        const stream = event.streams[0];
        // Get current state to check if remote user exists
        const currentState = useRoomStore.getState();
        // Update remote user stream and media state
        if (currentState.remoteUser) {
          // Update existing remote user with stream and media state
          setRemoteUser({
            ...currentState.remoteUser,
            mediaState: {
              isCameraOn: stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled,
              isMicOn: stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled,
              isScreenSharing: false,
            },
            stream: stream,
          });
        } else {
          // Fallback: create remote user if it doesn't exist (shouldn't happen normally)
          const userId = Math.random().toString(36).substring(2, 10);
          setRemoteUser({
            id: userId,
            name: `User ${userId.substring(0, 4)}`,
            role: 'viewer',
            mediaState: {
              isCameraOn: stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled,
              isMicOn: stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled,
              isScreenSharing: false,
            },
            stream: stream,
          });
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate);
        options?.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connecting':
          setConnectionStatus('connecting');
          break;
        case 'connected':
          setConnectionStatus('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          setConnectionStatus('disconnected');
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    return pc;
  }, [setConnectionStatus, setRemoteStream, setRemoteUser, options]);

  const createOffer = useCallback(async (targetSocketId?: string): Promise<RTCSessionDescriptionInit | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('PeerConnection not initialized');
      return null;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('Offer created:', offer);
      
      if (targetSocketId) {
        targetSocketIdRef.current = targetSocketId;
      }
      
      options?.onOffer?.(offer);
      
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      return null;
    }
  }, [options]);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit, targetSocketId: string): Promise<RTCSessionDescriptionInit | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('PeerConnection not initialized');
      return null;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Answer created:', answer);
      
      targetSocketIdRef.current = targetSocketId;
      
      // Process any pending ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current = [];
      
      options?.onAnswer?.(answer);
      
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      return null;
    }
  }, [options]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('PeerConnection not initialized');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set');
      
      // Process any pending ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current = [];
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    
    try {
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('ICE candidate added');
      } else {
        // Queue candidate if remote description not set yet
        pendingCandidatesRef.current.push(new RTCIceCandidate(candidate));
        console.log('ICE candidate queued');
      }
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  const replaceTrack = useCallback(async (newTrack: MediaStreamTrack, oldTrack?: MediaStreamTrack) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const senders = pc.getSenders();
    const sender = senders.find((s) => s.track?.kind === newTrack.kind || s.track === oldTrack);
    
    if (sender) {
      await sender.replaceTrack(newTrack);
      console.log(`Replaced ${newTrack.kind} track`);
    } else {
      // Add new track if no existing sender found
      pc.addTrack(newTrack);
      console.log(`Added new ${newTrack.kind} track`);
    }
  }, []);

  const addScreenShareTrack = useCallback((screenStream: MediaStream) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const videoTrack = screenStream.getVideoTracks()[0];
    const audioTrack = screenStream.getAudioTracks()[0];

    if (videoTrack) {
      pc.addTrack(videoTrack, screenStream);
    }
    if (audioTrack) {
      pc.addTrack(audioTrack, screenStream);
    }
  }, []);

  const removeScreenShareTrack = useCallback((screenStream: MediaStream) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const senders = pc.getSenders();
    screenStream.getTracks().forEach((track) => {
      const sender = senders.find((s) => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
      }
    });
  }, []);

  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingCandidatesRef.current = [];
  }, []);

  const getTargetSocketId = useCallback(() => {
    return targetSocketIdRef.current;
  }, []);

  return {
    peerConnection: peerConnectionRef.current,
    initializePeerConnection,
    createOffer,
    createAnswer,
    handleAnswer,
    addIceCandidate,
    replaceTrack,
    addScreenShareTrack,
    removeScreenShareTrack,
    getTargetSocketId,
    cleanup,
  };
};
