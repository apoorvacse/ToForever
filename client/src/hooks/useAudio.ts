import { useCallback, useRef, useEffect } from 'react';
import { useRoomStore } from '@/store/roomStore';

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

  // Set remote audio volume (0-1)
  const setRemoteVolume = useCallback((volume: number) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  // Set screen share (movie) volume (0-1)
  const setMovieVolume = useCallback((volume: number) => {
    if (screenAudioRef.current) {
      screenAudioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  // Connect remote stream to audio element
  const connectRemoteAudio = useCallback((stream: MediaStream) => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.muted = isRemoteAudioMuted;
  }, [isRemoteAudioMuted]);

  // Connect screen share audio
  const connectScreenAudio = useCallback((stream: MediaStream) => {
    if (!screenAudioRef.current) {
      screenAudioRef.current = new Audio();
      screenAudioRef.current.autoplay = true;
    }
    screenAudioRef.current.srcObject = stream;
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
