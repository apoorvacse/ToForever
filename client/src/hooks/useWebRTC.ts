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
      const track = event.track;
      const stream = event.streams[0];
      
      logger.log('Received remote track:', {
        kind: track.kind,
        label: track.label,
        streamId: stream?.id,
        streamCount: event.streams.length,
        trackId: track.id,
      });

      if (!stream) {
        logger.warn('Received track without stream');
        return;
      }

      const currentState = useRoomStore.getState();
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      // CRITICAL BUG FIX: Handle audio tracks that arrive separately from screen share
      // When sharing a tab, video and audio tracks can arrive in separate ontrack events
      // We need to check if this track belongs to an existing screen share stream
      
      // Check if this stream ID matches an existing screen share stream
      const existingScreenShareStream = currentState.screenShareStream;
      const isExistingScreenShareStream = existingScreenShareStream && stream.id === existingScreenShareStream.id;
      
      // If this is an audio-only track and matches existing screen share stream, merge it
      if (track.kind === 'audio' && isExistingScreenShareStream && !existingScreenShareStream.getAudioTracks().some(t => t.id === track.id)) {
        logger.log('🔊 Merging audio track into existing screen share stream', {
          trackLabel: track.label,
          streamId: stream.id,
        });
        
        // Add the audio track to the existing screen share stream
        existingScreenShareStream.addTrack(track);
        
        // Update the screen share stream to trigger re-render
        setScreenShareStream(new MediaStream(existingScreenShareStream));
        return;
      }
      
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
      
      // CRITICAL FIX: Also check if this is an audio track from a screen share stream
      // Audio tracks from screen share can arrive separately and need special handling
      if (!isScreenShare && track.kind === 'audio' && currentState.remoteUser?.stream) {
        const cameraStreamId = currentState.remoteUser.stream.id;
        // If this audio track is from a different stream than the camera, it might be screen share audio
        if (stream.id !== cameraStreamId) {
          // Check if we already have a screen share stream with this ID
          if (existingScreenShareStream && stream.id === existingScreenShareStream.id) {
            isScreenShare = true;
            logger.log('🔊 Detected screen share audio track via existing stream ID');
          } else if (!existingScreenShareStream) {
            // This might be a new screen share stream (audio arriving before video)
            // We'll create a screen share stream and add the audio track
            isScreenShare = true;
            logger.log('🔊 Detected potential screen share audio track (new stream)', {
              streamId: stream.id,
              trackLabel: track.label,
            });
          }
        }
      }

      if (isScreenShare) {
        // This is a screen share stream - store it separately
        logger.log('✅ Received remote screen share stream', {
          streamId: stream.id,
          videoTrackLabel: videoTrack?.label,
          audioTrackLabel: audioTrack?.label,
          hasVideo: !!videoTrack,
          hasAudio: stream.getAudioTracks().length > 0,
          audioTrackCount: stream.getAudioTracks().length,
        });
        
        // If we already have a screen share stream with this ID, merge tracks
        if (existingScreenShareStream && stream.id === existingScreenShareStream.id) {
          // Merge tracks from new stream into existing stream
          stream.getVideoTracks().forEach(track => {
            if (!existingScreenShareStream.getVideoTracks().some(t => t.id === track.id)) {
              existingScreenShareStream.addTrack(track);
              logger.log('Merged video track into existing screen share stream');
            }
          });
          stream.getAudioTracks().forEach(track => {
            if (!existingScreenShareStream.getAudioTracks().some(t => t.id === track.id)) {
              existingScreenShareStream.addTrack(track);
              logger.log('🔊 Merged audio track into existing screen share stream', {
                trackLabel: track.label,
              });
            }
          });
          // Update with new stream instance to trigger re-render
          setScreenShareStream(new MediaStream(existingScreenShareStream));
        } else {
          // New screen share stream
          setScreenShareStream(stream);
        }
        
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
        
        // Also listen for audio track ended
        if (audioTrack) {
          audioTrack.onended = () => {
            logger.log('🔊 Remote screen share audio track ended');
            const state = useRoomStore.getState();
            if (state.screenShareStream) {
              // Remove the ended audio track from the stream
              const updatedStream = new MediaStream(state.screenShareStream);
              updatedStream.getAudioTracks().forEach(t => {
                if (t.id === audioTrack.id) {
                  updatedStream.removeTrack(t);
                }
              });
              setScreenShareStream(updatedStream.getTracks().length > 0 ? updatedStream : null);
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
        
        // Helper function to update remote user media state
        const updateRemoteMediaState = (stream: MediaStream) => {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          
          const newMediaState = {
            isCameraOn: !!videoTrack && videoTrack.enabled,
            isMicOn: !!audioTrack && audioTrack.enabled,
            isScreenSharing: currentState.remoteUser?.mediaState.isScreenSharing || false,
          };
          
          if (currentState.remoteUser) {
            setRemoteUser({
              ...currentState.remoteUser,
              mediaState: newMediaState,
              stream: stream,
            });
          } else {
            // Fallback: create remote user if it doesn't exist
            const userId = Math.random().toString(36).substring(2, 10);
            setRemoteUser({
              id: userId,
              name: `User ${userId.substring(0, 4)}`,
              role: 'viewer',
              mediaState: newMediaState,
              stream: stream,
            });
          }
        };
        
        // Update media state immediately
        updateRemoteMediaState(stream);
        
        // CRITICAL FIX: Listen for track state changes (mute/unmute)
        // This ensures the remote UI updates in real-time when tracks are enabled/disabled
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        if (videoTrack) {
          // Remove old listener if exists
          const oldHandler = (videoTrack as any).__onEnabledChange;
          if (oldHandler) {
            videoTrack.removeEventListener('ended', oldHandler);
          }
          
          // Listen for track enabled/disabled changes
          const handleVideoTrackChange = () => {
            logger.log('Remote video track state changed:', {
              enabled: videoTrack.enabled,
              readyState: videoTrack.readyState,
            });
            updateRemoteMediaState(stream);
          };
          
          // Store handler for cleanup
          (videoTrack as any).__onEnabledChange = handleVideoTrackChange;
          
          // Use MutationObserver or polling to detect enabled changes
          // Since MediaStreamTrack doesn't fire events for enabled changes,
          // we'll poll the enabled state and update when it changes
          let lastVideoEnabled = videoTrack.enabled;
          const videoTrackPoll = setInterval(() => {
            if (videoTrack.readyState === 'ended') {
              clearInterval(videoTrackPoll);
              return;
            }
            if (videoTrack.enabled !== lastVideoEnabled) {
              lastVideoEnabled = videoTrack.enabled;
              handleVideoTrackChange();
            }
          }, 200); // Poll every 200ms
          
          // Cleanup on track end
          videoTrack.onended = () => {
            clearInterval(videoTrackPoll);
            updateRemoteMediaState(stream);
          };
        }
        
        if (audioTrack) {
          // Remove old listener if exists
          const oldHandler = (audioTrack as any).__onEnabledChange;
          if (oldHandler) {
            audioTrack.removeEventListener('ended', oldHandler);
          }
          
          // Listen for track enabled/disabled changes
          const handleAudioTrackChange = () => {
            logger.log('Remote audio track state changed:', {
              enabled: audioTrack.enabled,
              readyState: audioTrack.readyState,
            });
            updateRemoteMediaState(stream);
          };
          
          // Store handler for cleanup
          (audioTrack as any).__onEnabledChange = handleAudioTrackChange;
          
          // Poll for enabled state changes
          let lastAudioEnabled = audioTrack.enabled;
          const audioTrackPoll = setInterval(() => {
            if (audioTrack.readyState === 'ended') {
              clearInterval(audioTrackPoll);
              return;
            }
            if (audioTrack.enabled !== lastAudioEnabled) {
              lastAudioEnabled = audioTrack.enabled;
              handleAudioTrackChange();
            }
          }, 200); // Poll every 200ms
          
          // Cleanup on track end
          audioTrack.onended = () => {
            clearInterval(audioTrackPoll);
            updateRemoteMediaState(stream);
          };
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
    const allTracks = screenStream.getTracks();

    logger.log('Adding screen share tracks to peer connection', {
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      videoLabel: videoTrack?.label,
      audioLabel: audioTrack?.label,
      streamId: screenStream.id,
      totalTracks: allTracks.length,
      trackKinds: allTracks.map(t => t.kind),
    });

    // CRITICAL: Warn if no audio track is found
    // This helps debug tab audio sharing issues
    if (!audioTrack) {
      logger.warn('⚠️ No audio track found in screen share stream!', {
        streamId: screenStream.id,
        videoTrackLabel: videoTrack?.label,
        allTracks: allTracks.map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled, readyState: t.readyState })),
        hint: 'Make sure "Share tab audio" is checked in the browser screen share dialog',
      });
    } else {
      logger.log('🔊 Screen share audio track found', {
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
      });
    }

    // Check if tracks are already added
    const existingSenders = pc.getSenders();
    const hasVideoSender = existingSenders.some(s => s.track === videoTrack);
    const hasAudioSender = audioTrack ? existingSenders.some(s => s.track === audioTrack) : false;

    // Add tracks with the screen stream so they can be identified
    if (videoTrack && !hasVideoSender) {
      pc.addTrack(videoTrack, screenStream);
      logger.log('✅ Added screen share video track');
    } else if (videoTrack && hasVideoSender) {
      logger.log('Screen share video track already added');
    }
    
    if (audioTrack && !hasAudioSender) {
      pc.addTrack(audioTrack, screenStream);
      logger.log('🔊 Added screen share audio track', {
        trackLabel: audioTrack.label,
        trackId: audioTrack.id,
      });
    } else if (audioTrack && hasAudioSender) {
      logger.log('Screen share audio track already added');
    } else if (!audioTrack) {
      logger.warn('⚠️ Cannot add screen share audio track - track not found in stream');
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
