import { useCallback, useRef, useEffect } from 'react';
import { useRoomStore } from '@/store/roomStore';
import { logger } from '@/lib/logger';

export const useAudio = () => {
  const { isRemoteAudioMuted, setRemoteAudioMuted, remoteUser, screenShareStream } = useRoomStore();
  
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const screenAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize Web Audio API for advanced audio control
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  }, []);

  // Mute/unmute remote audio (voice chat)
  const toggleRemoteAudio = useCallback(() => {
    setRemoteAudioMuted(!isRemoteAudioMuted);
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isRemoteAudioMuted;
    }
  }, [isRemoteAudioMuted, setRemoteAudioMuted]);

  /**
   * Set remote audio volume (0-1)
   * 
   * BUG FIX: Previously, volume changes weren't being applied because:
   * 1. Audio element might not be initialized when volume is set
   * 2. Volume needs to be set after stream is connected
   * 
   * SOLUTION: 
   * 1. Ensure audio element exists before setting volume
   * 2. Clamp volume to valid range (0-1)
   * 3. Store volume in ref so it can be applied when audio element is created
   */
  const remoteVolumeRef = useRef<number>(1.0);
  const movieVolumeRef = useRef<number>(1.0);

  const setRemoteVolume = useCallback((volume: number) => {
    // Clamp volume to valid range
    const clampedVolume = Math.max(0, Math.min(1, volume));
    remoteVolumeRef.current = clampedVolume;
    
    // Apply volume if audio element exists
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = clampedVolume;
      logger.log(`Remote audio volume set to: ${(clampedVolume * 100).toFixed(0)}%`);
    }
  }, []);

  /**
   * Set screen share (movie) volume (0-1)
   * 
   * BUG FIX: Same issue as remote volume - volume wasn't being applied
   * 
   * SOLUTION: Store volume in ref and apply when audio element exists
   */
  const setMovieVolume = useCallback((volume: number) => {
    // Clamp volume to valid range
    const clampedVolume = Math.max(0, Math.min(1, volume));
    movieVolumeRef.current = clampedVolume;
    
    // Apply volume if audio element exists
    if (screenAudioRef.current) {
      screenAudioRef.current.volume = clampedVolume;
      logger.log(`Movie audio volume set to: ${(clampedVolume * 100).toFixed(0)}%`);
    }
  }, []);

  /**
   * Connect remote stream to audio element
   * 
   * BUG FIX: Volume wasn't being applied when audio element was created
   * 
   * SOLUTION: Apply stored volume when connecting stream
   */
  const connectRemoteAudio = useCallback((stream: MediaStream) => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.muted = isRemoteAudioMuted;
    // Apply stored volume when connecting
    remoteAudioRef.current.volume = remoteVolumeRef.current;
    logger.log(`Remote audio connected, volume: ${(remoteVolumeRef.current * 100).toFixed(0)}%`);
  }, [isRemoteAudioMuted]);

  /**
   * Connect screen share audio
   * 
   * BUG FIX: Volume wasn't being applied when audio element was created
   * CRITICAL FIX: Handle stream updates when audio tracks are added later
   * 
   * SOLUTION: 
   * 1. Apply stored volume when connecting stream
   * 2. Check for audio tracks and log warnings if missing
   * 3. Handle stream updates properly
   */
  const connectScreenAudio = useCallback((stream: MediaStream) => {
    if (!stream) {
      logger.warn('connectScreenAudio called with null/undefined stream');
      return;
    }
    
    const audioTracks = stream.getAudioTracks();
    logger.log('🔊 Connecting screen share audio', {
      streamId: stream.id,
      audioTrackCount: audioTracks.length,
      audioTrackLabels: audioTracks.map(t => t.label),
      audioTracksEnabled: audioTracks.map(t => t.enabled),
    });
    
    if (audioTracks.length === 0) {
      logger.warn('⚠️ No audio tracks in screen share stream!', {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        hint: 'Audio track may arrive later, or "Share tab audio" was not checked',
      });
    }
    
    if (!screenAudioRef.current) {
      screenAudioRef.current = new Audio();
      screenAudioRef.current.autoplay = true;
      screenAudioRef.current.volume = movieVolumeRef.current;
      logger.log('Created new screen share audio element');
    }
    
    // CRITICAL: Update srcObject even if it's the same stream reference
    // This ensures audio tracks added later are properly connected
    const currentSrcObject = screenAudioRef.current.srcObject as MediaStream | null;
    if (currentSrcObject?.id !== stream.id || currentSrcObject?.getAudioTracks().length !== audioTracks.length) {
      screenAudioRef.current.srcObject = stream;
      logger.log('🔊 Updated screen share audio srcObject', {
        oldStreamId: currentSrcObject?.id,
        newStreamId: stream.id,
        oldAudioTracks: currentSrcObject?.getAudioTracks().length || 0,
        newAudioTracks: audioTracks.length,
      });
    }
    
    // Apply stored volume
    screenAudioRef.current.volume = movieVolumeRef.current;
    
    // Listen for audio track additions to the stream
    const handleAddTrack = (event: MediaStreamTrackEvent) => {
      if (event.track.kind === 'audio') {
        logger.log('🔊 Audio track added to screen share stream (detected in useAudio)', {
          trackLabel: event.track.label,
          streamId: stream.id,
        });
        // Update srcObject to ensure the new track is connected
        if (screenAudioRef.current) {
          screenAudioRef.current.srcObject = stream;
        }
      }
    };
    
    // Remove old listener if it exists
    stream.removeEventListener('addtrack', handleAddTrack);
    // Add new listener
    stream.addEventListener('addtrack', handleAddTrack);
    
    logger.log(`🔊 Screen share audio connected, volume: ${(movieVolumeRef.current * 100).toFixed(0)}%`, {
      audioTrackCount: audioTracks.length,
    });
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (screenAudioRef.current) {
      screenAudioRef.current.srcObject = null;
      screenAudioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  // Auto-connect when remote stream changes
  useEffect(() => {
    if (remoteUser?.stream) {
      connectRemoteAudio(remoteUser.stream);
    }
  }, [remoteUser?.stream, connectRemoteAudio]);

  // Auto-connect screen share audio
  useEffect(() => {
    if (screenShareStream) {
      connectScreenAudio(screenShareStream);
    }
  }, [screenShareStream, connectScreenAudio]);

  return {
    isRemoteAudioMuted,
    toggleRemoteAudio,
    setRemoteVolume,
    setMovieVolume,
    initAudioContext,
    cleanup,
  };
};
