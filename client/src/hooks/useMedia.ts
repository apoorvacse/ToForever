import { useCallback, useRef, useState } from 'react';
import { useRoomStore } from '@/store/roomStore';
import { logger } from '@/lib/logger';

export const useMedia = () => {
  const { updateLocalMedia, setLocalStream, setScreenShareStream, setHostId, localUser } = useRoomStore();
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const initializeMedia = useCallback(async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      updateLocalMedia({ isCameraOn: true, isMicOn: true });
      
      return stream;
    } catch (error) {
      logger.error('Failed to get media:', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Camera and microphone access denied. Please allow access to continue.');
        } else if (error.name === 'NotFoundError') {
          setPermissionError('No camera or microphone found. Please connect a device.');
        } else {
          setPermissionError('Failed to access media devices. Please try again.');
        }
      }
      throw error;
    }
  }, [setLocalStream, updateLocalMedia]);

  /**
   * Toggle camera on/off
   * 
   * EFFICIENT APPROACH:
   * - Simply enable/disable the video track
   * - No reloading, no delays, no complex logic
   * - Modern browsers handle track.enabled changes automatically
   * - Video element stays attached, just track state changes
   */
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        updateLocalMedia({ isCameraOn: videoTrack.enabled });
        logger.log(`Camera ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [updateLocalMedia]);

  /**
   * Toggle microphone on/off
   * 
   * IMPROVEMENT: Added proper state tracking and logging
   */
  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const wasEnabled = audioTrack.enabled;
        audioTrack.enabled = !audioTrack.enabled;
        updateLocalMedia({ isMicOn: audioTrack.enabled });
        logger.log(`Microphone ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
        
        // Verify track state after toggle
        if (audioTrack.enabled && audioTrack.readyState !== 'live') {
          logger.warn('Audio track enabled but not in live state');
        }
      }
    }
  }, [updateLocalMedia]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenShareStream(null);
      updateLocalMedia({ isScreenSharing: false });
      setHostId(null);
    }
  }, [setHostId, setScreenShareStream, updateLocalMedia]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      
      logger.log('Screen share stream captured', {
        hasVideo: stream.getVideoTracks().length > 0,
        hasAudio: stream.getAudioTracks().length > 0,
        videoTracks: stream.getVideoTracks().map(t => ({ label: t.label, enabled: t.enabled })),
        audioTracks: stream.getAudioTracks().map(t => ({ label: t.label, enabled: t.enabled })),
      });
      
      // CRITICAL: Warn if no audio track is present
      // This helps users understand why tab audio might not work
      if (stream.getAudioTracks().length === 0) {
        logger.warn('⚠️ No audio track in screen share stream!', {
          hint: 'Make sure "Share tab audio" is checked in the browser dialog',
          videoTrackLabel: stream.getVideoTracks()[0]?.label,
        });
      } else {
        logger.log('🔊 Screen share audio track present', {
          audioTrackLabel: stream.getAudioTracks()[0].label,
          audioTrackEnabled: stream.getAudioTracks()[0].enabled,
        });
      }
      
      screenStreamRef.current = stream;
      setScreenShareStream(stream);
      updateLocalMedia({ isScreenSharing: true });
      
      if (localUser) {
        setHostId(localUser.id);
      }
      
      // Handle when user stops sharing via browser UI
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
      
      // CRITICAL FIX: Listen for audio track additions
      // Some browsers add audio tracks asynchronously after the initial capture
      // We need to detect when audio tracks are added and update the stream
      const checkForAudioTracks = () => {
        const currentAudioTracks = stream.getAudioTracks();
        if (currentAudioTracks.length > 0 && screenStreamRef.current === stream) {
          logger.log('🔊 Audio track detected in screen share stream (late addition)', {
            audioTrackLabel: currentAudioTracks[0].label,
          });
          // Update the screen share stream to trigger re-render and re-add to peer connection
          setScreenShareStream(new MediaStream(stream));
        }
      };
      
      // Check immediately and also set up a listener for track additions
      checkForAudioTracks();
      
      // Some browsers fire 'addtrack' event when tracks are added
      stream.addEventListener('addtrack', (event) => {
        if (event.track.kind === 'audio') {
          logger.log('🔊 Audio track added to screen share stream', {
            trackLabel: event.track.label,
          });
          checkForAudioTracks();
        }
      });
      
      return stream;
    } catch (error) {
      logger.error('Failed to start screen share:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        // User cancelled - not an error
        return null;
      }
      throw error;
    }
  }, [localUser, setHostId, setScreenShareStream, updateLocalMedia, stopScreenShare]);

  /**
   * Cleanup all media streams and tracks
   * 
   * IMPROVEMENT: Proper cleanup to prevent memory leaks
   * - Stop all tracks before clearing refs
   * - Clear refs to allow garbage collection
   */
  const cleanup = useCallback(() => {
    // Cleanup local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      localStreamRef.current = null;
    }
    
    // Cleanup screen share stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      screenStreamRef.current = null;
    }
    
    logger.log('Media cleanup completed');
  }, []);

  return {
    localStream: localStreamRef.current,
    screenStream: screenStreamRef.current,
    permissionError,
    initializeMedia,
    toggleCamera,
    toggleMicrophone,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
};
