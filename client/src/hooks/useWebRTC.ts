import { useCallback, useRef } from 'react';
import { useRoomStore } from '@/store/roomStore';
import { logger } from '@/lib/logger';

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
  const { setConnectionStatus, setRemoteStream, setRemoteUser, setScreenShareStream } = useRoomStore();
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
      logger.log('Received remote track:', {
        kind: event.track.kind,
        label: event.track.label,
        streamId: event.streams[0]?.id,
        streamCount: event.streams.length,
      });

      if (event.streams[0]) {
        const stream = event.streams[0];
        const currentState = useRoomStore.getState();
        const videoTrack = stream.getVideoTracks()[0];
        
        // BUG FIX: Better detection of screen share tracks
        // Method 1: Check track label (most reliable)
        let isScreenShare = false;
        
        if (videoTrack) {
          const label = videoTrack.label.toLowerCase();
          
          // Screen share tracks typically have labels containing:
          // - "screen" (e.g., "screen:0:0")
          // - "display" (e.g., "Display 1")
          // - "monitor" 
          // - "window"
          // - "application" (for window sharing)
          isScreenShare = label.includes('screen') || 
                         label.includes('display') || 
                         label.includes('monitor') ||
                         label.includes('window') ||
                         label.includes('application');
          
          // Method 2: Check getSettings().displaySurface (most accurate)
          if (!isScreenShare) {
            try {
              const settings = videoTrack.getSettings();
              if (settings.displaySurface) {
                isScreenShare = settings.displaySurface === 'screen' || 
                               settings.displaySurface === 'window' ||
                               settings.displaySurface === 'browser' ||
                               settings.displaySurface === 'application';
                logger.log('Detected screen share via displaySurface:', settings.displaySurface);
              }
            } catch (e) {
              logger.warn('Could not access track settings:', e);
            }
          }
          
          // Method 3: Check if this is a different stream from the camera stream
          // Screen share streams are usually separate from camera streams
          if (!isScreenShare && currentState.remoteUser?.stream) {
            const existingStreamId = currentState.remoteUser.stream.id;
            // If we already have a remote user stream, and this is a different stream with video,
            // it's likely a screen share (camera and screen share come in separate streams)
            if (stream.id !== existingStreamId && videoTrack) {
              // Double-check: if we already have a screen share stream, don't overwrite it
              // unless this new stream is definitely a screen share
              if (!currentState.screenShareStream || currentState.screenShareStream.id === stream.id) {
                isScreenShare = true;
                logger.log('Detected screen share via different stream ID', {
                  newStreamId: stream.id,
                  existingStreamId: existingStreamId,
                });
              }
            }
          }
          
          // Method 4: Fallback - if we already have a camera stream and this is a different stream,
          // it's likely screen share (camera and screen share are separate streams)
          if (!isScreenShare && currentState.remoteUser?.stream && videoTrack) {
            const cameraStreamId = currentState.remoteUser.stream.id;
            if (stream.id !== cameraStreamId) {
              // Different stream ID = likely screen share
              isScreenShare = true;
              logger.log('Detected screen share via stream ID difference (fallback)', {
                newStreamId: stream.id,
                cameraStreamId: cameraStreamId,
              });
            }
          }
          
          // Method 5: If we don't have a remote user stream yet, but we have a screen share stream,
          // check if this is the same stream
          if (!isScreenShare && !currentState.remoteUser?.stream && currentState.screenShareStream) {
            if (stream.id === currentState.screenShareStream.id) {
              // This is the same stream as screen share, so it's screen share
              isScreenShare = true;
              logger.log('Detected screen share via existing screen share stream ID');
            }
          }
        }

        if (isScreenShare) {
          // This is a screen share stream - store it separately
          logger.log('✅ Received remote screen share stream', {
            streamId: stream.id,
            videoTrackLabel: videoTrack?.label,
            hasVideo: !!videoTrack,
            hasAudio: stream.getAudioTracks().length > 0,
          });
          
          setScreenShareStream(stream);
          
          // Also update remote user's screen sharing state
          if (currentState.remoteUser) {
            setRemoteUser({
              ...currentState.remoteUser,
              mediaState: {
                ...currentState.remoteUser.mediaState,
                isScreenSharing: true,
              },
            });
          }
          
          // BUG FIX: Handle when remote host stops screen sharing
          // Listen for track ended event to clear screen share stream
          if (videoTrack) {
            videoTrack.onended = () => {
              logger.log('Remote screen share ended');
              setScreenShareStream(null);
              const state = useRoomStore.getState();
              if (state.remoteUser) {
                setRemoteUser({
                  ...state.remoteUser,
                  mediaState: {
                    ...state.remoteUser.mediaState,
                    isScreenSharing: false,
                  },
                });
              }
            };
          }
        } else {
          // This is a camera/audio stream - update remote user
          logger.log('Received camera/audio stream', {
            streamId: stream.id,
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0,
          });
          
          if (currentState.remoteUser) {
            setRemoteUser({
              ...currentState.remoteUser,
              mediaState: {
                isCameraOn: stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled,
                isMicOn: stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled,
                isScreenSharing: currentState.remoteUser.mediaState.isScreenSharing, // Preserve screen share state
              },
              stream: stream,
            });
          } else {
            // Fallback: create remote user if it doesn't exist
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
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        logger.log('ICE candidate generated:', event.candidate);
        options?.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      logger.log('Connection state:', pc.connectionState);
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
      logger.log('ICE connection state:', pc.iceConnectionState);
    };

    return pc;
  }, [setConnectionStatus, setRemoteStream, setRemoteUser, setScreenShareStream, options]);

  const createOffer = useCallback(async (targetSocketId?: string): Promise<RTCSessionDescriptionInit | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      logger.error('PeerConnection not initialized');
      return null;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      logger.log('Offer created:', offer);
      
      if (targetSocketId) {
        targetSocketIdRef.current = targetSocketId;
      }
      
      options?.onOffer?.(offer);
      
      return offer;
    } catch (error) {
      logger.error('Failed to create offer:', error);
      return null;
    }
  }, [options]);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit, targetSocketId: string): Promise<RTCSessionDescriptionInit | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      logger.error('PeerConnection not initialized');
      return null;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      logger.log('Answer created:', answer);
      
      targetSocketIdRef.current = targetSocketId;
      
      // Process any pending ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current = [];
      
      options?.onAnswer?.(answer);
      
      return answer;
    } catch (error) {
      logger.error('Failed to create answer:', error);
      return null;
    }
  }, [options]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      logger.error('PeerConnection not initialized');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      logger.log('Remote description set');
      
      // Process any pending ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current = [];
    } catch (error) {
      logger.error('Failed to handle answer:', error);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    
    try {
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        logger.log('ICE candidate added');
      } else {
        // Queue candidate if remote description not set yet
        pendingCandidatesRef.current.push(new RTCIceCandidate(candidate));
        logger.log('ICE candidate queued');
      }
    } catch (error) {
      logger.error('Failed to add ICE candidate:', error);
    }
  }, []);

  const replaceTrack = useCallback(async (newTrack: MediaStreamTrack, oldTrack?: MediaStreamTrack) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const senders = pc.getSenders();
    const sender = senders.find((s) => s.track?.kind === newTrack.kind || s.track === oldTrack);
    
    if (sender) {
      await sender.replaceTrack(newTrack);
      logger.log(`Replaced ${newTrack.kind} track`);
    } else {
      // Add new track if no existing sender found
      pc.addTrack(newTrack);
      logger.log(`Added new ${newTrack.kind} track`);
    }
  }, []);

  /**
   * Add screen share tracks to peer connection
   * 
   * BUG FIX: When adding screen share tracks, we need to:
   * 1. Add tracks to peer connection
   * 2. Create a new offer to send tracks to remote peer
   * 3. Ensure the offer is sent via socket
   */
  const addScreenShareTrack = useCallback(async (screenStream: MediaStream) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      logger.error('PeerConnection not initialized');
      return;
    }

    const videoTrack = screenStream.getVideoTracks()[0];
    const audioTrack = screenStream.getAudioTracks()[0];

    logger.log('Adding screen share tracks to peer connection', {
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      videoLabel: videoTrack?.label,
      streamId: screenStream.id,
    });

    // Check if tracks are already added
    const existingSenders = pc.getSenders();
    const hasVideoSender = existingSenders.some(s => s.track === videoTrack);
    const hasAudioSender = audioTrack ? existingSenders.some(s => s.track === audioTrack) : false;

    // Add tracks with the screen stream so they can be identified
    if (videoTrack && !hasVideoSender) {
      pc.addTrack(videoTrack, screenStream);
      logger.log('Added screen share video track');
    }
    if (audioTrack && !hasAudioSender) {
      pc.addTrack(audioTrack, screenStream);
      logger.log('Added screen share audio track');
    }

    // Create a new offer to send the screen share tracks
    // This ensures the remote peer receives the tracks
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      logger.log('✅ Created offer for screen share tracks', {
        offerType: offer.type,
        sdpLength: offer.sdp?.length,
      });
      
      // Send offer via callback (which will emit via socket)
      if (options?.onOffer) {
        options.onOffer(offer);
        logger.log('✅ Screen share offer sent via socket');
      } else {
        logger.error('❌ onOffer callback not available - offer not sent!');
      }
    } catch (error) {
      logger.error('❌ Failed to create offer for screen share:', error);
    }
  }, [options]);

  /**
   * Remove screen share tracks from peer connection
   * 
   * BUG FIX: When removing screen share tracks, create a new offer
   * to notify the remote peer that screen sharing has stopped
   */
  const removeScreenShareTrack = useCallback(async (screenStream: MediaStream) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      logger.error('PeerConnection not initialized');
      return;
    }

    const senders = pc.getSenders();
    let removedAny = false;
    
    screenStream.getTracks().forEach((track) => {
      const sender = senders.find((s) => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
        removedAny = true;
        logger.log('Removed screen share track:', track.kind);
      }
    });

    // If we removed tracks, create a new offer to notify remote peer
    if (removedAny) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        logger.log('Created offer after removing screen share tracks');
        
        if (options?.onOffer) {
          options.onOffer(offer);
        }
      } catch (error) {
        logger.error('Failed to create offer after removing screen share:', error);
      }
    }
  }, [options]);

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
