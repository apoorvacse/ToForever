import { useCallback, useRef, useState } from 'react';
import { useRoomStore } from '@/store/roomStore';

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
      console.error('Failed to get media:', error);
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

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        updateLocalMedia({ isCameraOn: videoTrack.enabled });
      }
    }
  }, [updateLocalMedia]);

  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        updateLocalMedia({ isMicOn: audioTrack.enabled });
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
      
      screenStreamRef.current = stream;
      setScreenShareStream(stream);
      updateLocalMedia({ isScreenSharing: true });
      
      if (localUser) {
        setHostId(localUser.id);
      }
      
      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      return stream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        // User cancelled - not an error
        return null;
      }
      throw error;
    }
  }, [localUser, setHostId, setScreenShareStream, updateLocalMedia, stopScreenShare]);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
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
