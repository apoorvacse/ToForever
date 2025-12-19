import { useState, useEffect, useCallback, RefObject } from 'react';
import { logger } from '@/lib/logger';

interface UsePictureInPictureOptions {
  videoRef: RefObject<HTMLVideoElement>;
  onEnter?: () => void;
  onExit?: () => void;
}

interface UsePictureInPictureReturn {
  isPipActive: boolean;
  isPipSupported: boolean;
  togglePip: () => Promise<void>;
  enterPip: () => Promise<void>;
  exitPip: () => Promise<void>;
}

/**
 * Custom hook to manage Picture-in-Picture functionality
 * Uses the browser's native PiP API for cross-tab video visibility
 */
export const usePictureInPicture = ({
  videoRef,
  onEnter,
  onExit,
}: UsePictureInPictureOptions): UsePictureInPictureReturn => {
  const [isPipActive, setIsPipActive] = useState(false);

  // Check if PiP is supported in this browser
  const isPipSupported = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  // Handle PiP enter event
  const handleEnterPip = useCallback(() => {
    setIsPipActive(true);
    onEnter?.();
  }, [onEnter]);

  // Handle PiP exit event
  const handleLeavePip = useCallback(() => {
    setIsPipActive(false);
    onExit?.();
  }, [onExit]);

  // Set up PiP event listeners on the video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isPipSupported) return;

    videoElement.addEventListener('enterpictureinpicture', handleEnterPip);
    videoElement.addEventListener('leavepictureinpicture', handleLeavePip);

    // Check if this video is already in PiP (edge case)
    if (document.pictureInPictureElement === videoElement) {
      setIsPipActive(true);
    }

    return () => {
      videoElement.removeEventListener('enterpictureinpicture', handleEnterPip);
      videoElement.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, [videoRef, isPipSupported, handleEnterPip, handleLeavePip]);

  // Enter Picture-in-Picture mode
  const enterPip = useCallback(async () => {
    const videoElement = videoRef.current;
    
    if (!videoElement || !isPipSupported) {
      logger.warn('PiP not supported or video element not available');
      return;
    }

    // Check if video has valid source
    if (!videoElement.srcObject && !videoElement.src) {
      logger.warn('Video has no source, cannot enter PiP');
      return;
    }

    try {
      // Exit any existing PiP first (only one video can be in PiP)
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      
      await videoElement.requestPictureInPicture();
    } catch (error) {
      logger.error('Failed to enter PiP:', error);
    }
  }, [videoRef, isPipSupported]);

  // Exit Picture-in-Picture mode
  const exitPip = useCallback(async () => {
    if (!isPipSupported) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch (error) {
      logger.error('Failed to exit PiP:', error);
    }
  }, [isPipSupported]);

  // Toggle PiP state
  const togglePip = useCallback(async () => {
    if (isPipActive) {
      await exitPip();
    } else {
      await enterPip();
    }
  }, [isPipActive, enterPip, exitPip]);

  return {
    isPipActive,
    isPipSupported,
    togglePip,
    enterPip,
    exitPip,
  };
};
