import { useEffect, useCallback, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore';
import { useMedia } from '@/hooks/useMedia';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAudio } from '@/hooks/useAudio';
import { useSocket } from '@/hooks/useSocket';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { VideoTile, VideoTileRef } from '@/components/VideoTile';
import { ScreenPlayer } from '@/components/ScreenPlayer';
import { ControlBar } from '@/components/ControlBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PipButton } from '@/components/PipButton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasSuggestedPip, setHasSuggestedPip] = useState(false);
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false);
  
  // Ref for partner's video element (for PiP)
  const remoteVideoRef = useRef<VideoTileRef>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Store timeout refs for cleanup
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());
  
  // Helper to create tracked timeouts
  const createTrackedTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      timeoutRefs.current.delete(timeout);
      callback();
    }, delay);
    timeoutRefs.current.add(timeout);
    return timeout;
  }, []);

  const {
    connectionStatus,
    localUser,
    remoteUser,
    screenShareStream,
    hostId,
    isRemoteAudioMuted,
    setRoomId,
    setLocalUser,
    setConnectionStatus,
    setRemoteUser,
    resetRoom,
  } = useRoomStore();

  const {
    permissionError,
    initializeMedia,
    toggleCamera: toggleCameraMedia,
    toggleMicrophone: toggleMicrophoneMedia,
    startScreenShare,
    stopScreenShare,
    cleanup: cleanupMedia,
  } = useMedia();
  
  // Wrapped toggle functions with error handling and state sync
  const toggleCamera = useCallback(() => {
    try {
      toggleCameraMedia();
    } catch (error) {
      logger.error('Failed to toggle camera:', error);
      toast({
        title: 'Camera error',
        description: 'Failed to toggle camera. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toggleCameraMedia, toast]);
  
  const toggleMicrophone = useCallback(() => {
    try {
      toggleMicrophoneMedia();
    } catch (error) {
      logger.error('Failed to toggle microphone:', error);
      toast({
        title: 'Microphone error',
        description: 'Failed to toggle microphone. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toggleMicrophoneMedia, toast]);

  // Socket and WebRTC refs for callbacks
  const socketEmitRef = useRef<{
    emitOffer: (offer: RTCSessionDescriptionInit, targetSocketId?: string) => void;
    emitAnswer: (answer: RTCSessionDescriptionInit, targetSocketId: string) => void;
    emitIceCandidate: (candidate: RTCIceCandidateInit, targetSocketId?: string) => void;
    emitHostChanged: () => void;
  } | null>(null);

  const webrtcRef = useRef<{
    createOffer: (targetSocketId?: string) => Promise<RTCSessionDescriptionInit | null>;
    createAnswer: (offer: RTCSessionDescriptionInit, targetSocketId: string) => Promise<RTCSessionDescriptionInit | null>;
    handleAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
    addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
    addScreenShareTrack: (screenStream: MediaStream) => Promise<void>;
    removeScreenShareTrack: (screenStream: MediaStream) => Promise<void>;
    replaceTrack: (newTrack: MediaStreamTrack, oldTrack?: MediaStreamTrack) => Promise<void>;
    getTargetSocketId: () => string | null;
  } | null>(null);

  // WebRTC hook with socket integration
  const {
    initializePeerConnection,
    createOffer,
    createAnswer,
    handleAnswer,
    addIceCandidate,
    addScreenShareTrack,
    removeScreenShareTrack,
    replaceTrack,
    getTargetSocketId,
    cleanup: cleanupWebRTC,
  } = useWebRTC({
    onIceCandidate: (candidate) => {
      socketEmitRef.current?.emitIceCandidate(candidate, getTargetSocketId() || undefined);
    },
    onOffer: (offer) => {
      socketEmitRef.current?.emitOffer(offer, getTargetSocketId() || undefined);
    },
    onAnswer: (answer) => {
      const targetSocketId = getTargetSocketId();
      if (targetSocketId) {
        socketEmitRef.current?.emitAnswer(answer, targetSocketId);
      }
    },
  });

  // Store WebRTC functions in ref
  useEffect(() => {
    webrtcRef.current = {
      createOffer,
      createAnswer,
      handleAnswer,
      addIceCandidate,
      addScreenShareTrack,
      removeScreenShareTrack,
      replaceTrack,
      getTargetSocketId,
    };
  }, [createOffer, createAnswer, handleAnswer, addIceCandidate, addScreenShareTrack, removeScreenShareTrack, replaceTrack, getTargetSocketId]);

  const {
    toggleRemoteAudio,
    setRemoteVolume,
    setMovieVolume,
    setMicVolume,
    cleanup: cleanupAudio,
  } = useAudio();
  
  // Handle mic volume change with track replacement
  const handleMicVolumeChange = useCallback((volume: number) => {
    const localStream = localUser?.stream || null;
    const replaceTrackFn = async (newTrack: MediaStreamTrack) => {
      if (webrtcRef.current) {
        const oldTrack = localStream?.getAudioTracks()[0];
        await webrtcRef.current.replaceTrack(newTrack, oldTrack);
      }
    };
    setMicVolume(volume, localStream, replaceTrackFn);
  }, [localUser?.stream, setMicVolume]);

  // Picture-in-Picture for partner's video
  const { isPipActive, isPipSupported, togglePip } = usePictureInPicture({
    videoRef: pipVideoRef as React.RefObject<HTMLVideoElement>,
    onEnter: () => {
      toast({
        title: 'Picture-in-Picture active',
        description: "Partner's video is now floating. You can switch tabs!",
      });
    },
    onExit: () => {
      toast({
        title: 'Picture-in-Picture closed',
        description: 'Partner video returned to the app.',
      });
    },
  });

  // Keep pipVideoRef in sync with remoteVideoRef
  useEffect(() => {
    if (remoteVideoRef.current) {
      pipVideoRef.current = remoteVideoRef.current.getVideoElement();
    }
  }, [remoteUser?.stream]);

  // Detect tab visibility changes to suggest PiP
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isPipActive && remoteUser?.stream && !hasSuggestedPip) {
        // User switched tabs and PiP is not active
        toast({
          title: 'Keep reactions visible',
          description: 'Click "Pop Partner Video" to see your partner while watching.',
          duration: 5000,
        });
        setHasSuggestedPip(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPipActive, remoteUser?.stream, hasSuggestedPip, toast]);

  // Check if partner is available for PiP
  const isPartnerAvailable = !!(remoteUser?.stream && remoteUser.mediaState.isCameraOn);

  // Socket hook for signaling (only connect when we have roomId and userId)
  const socket = useSocket({
    roomId: roomId || null,
    userId: localUser?.id || '',
    userName: localUser?.name,
    onPeerJoined: useCallback((data) => {
      logger.log('Peer joined:', data);
      // Set remote user info when peer joins
      setRemoteUser({
        id: data.userId,
        name: data.name,
        role: 'viewer',
        mediaState: {
          isCameraOn: false,
          isMicOn: false,
          isScreenSharing: false,
        },
        stream: null,
      });
      toast({
        title: 'Peer joined',
        description: `${data.name} joined the room.`,
      });
      // Wait a bit for peer connection to be ready, then create offer
      createTrackedTimeout(() => {
        if (webrtcRef.current) {
          webrtcRef.current.createOffer(data.socketId).catch((err) => {
            logger.error('Failed to create offer:', err);
          });
        }
      }, 500);
    }, [toast, setRemoteUser]),
    onPeerLeft: useCallback((data) => {
      logger.log('Peer left:', data);
      toast({
        title: 'Peer left',
        description: 'Your partner has left the room.',
      });
      setRemoteUser(null);
      // BUG FIX: Clear screen share stream when remote user leaves
      const { setScreenShareStream } = useRoomStore.getState();
      setScreenShareStream(null);
    }, [toast, setRemoteUser]),
    onOffer: useCallback(async (data) => {
      logger.log('Received offer (may contain screen share tracks):', data);
      if (webrtcRef.current) {
        const answer = await webrtcRef.current.createAnswer(data.offer, data.fromSocketId);
        if (!answer) {
          logger.error('Failed to create answer');
        } else {
          logger.log('✅ Created answer for offer');
        }
      }
    }, []),
    onAnswer: useCallback(async (data) => {
      logger.log('Received answer:', data);
      if (webrtcRef.current) {
        await webrtcRef.current.handleAnswer(data.answer);
      }
    }, []),
    onIceCandidate: useCallback(async (data) => {
      logger.log('Received ICE candidate:', data);
      if (webrtcRef.current) {
        await webrtcRef.current.addIceCandidate(data.candidate);
      }
    }, []),
    onCreateOffer: useCallback(async (data) => {
      logger.log('Create offer requested:', data);
      // Wait a bit for peer connection to be ready
      createTrackedTimeout(async () => {
        if (webrtcRef.current) {
          await webrtcRef.current.createOffer(data.targetSocketId);
        }
      }, 500);
    }, []),
    onHostChanged: useCallback((data) => {
      logger.log('Host changed:', data);
      toast({
        title: 'Host changed',
        description: `${data.hostName} is now the host.`,
      });
    }, [toast]),
    onError: useCallback((data) => {
      logger.error('Socket error:', data);
      toast({
        title: 'Connection error',
        description: data.message || 'An error occurred',
        variant: 'destructive',
      });
    }, [toast]),
  });

  // Store socket emit functions in ref
  useEffect(() => {
    socketEmitRef.current = {
      emitOffer: socket.emitOffer,
      emitAnswer: socket.emitAnswer,
      emitIceCandidate: socket.emitIceCandidate,
      emitHostChanged: socket.emitHostChanged,
    };
  }, [socket]);

  // Generate user ID once on mount
  const userIdRef = useRef<string | null>(null);
  if (!userIdRef.current) {
    userIdRef.current = Math.random().toString(36).substring(2, 10);
  }

  // Set up local user when roomId is available
  useEffect(() => {
    if (!roomId || localUser) return;

    setRoomId(roomId);
    setLocalUser({
      id: userIdRef.current!,
      name: `User ${userIdRef.current!.substring(0, 4)}`,
      role: 'viewer',
      mediaState: {
        isCameraOn: false,
        isMicOn: false,
        isScreenSharing: false,
      },
      stream: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // Only depend on roomId to avoid loops with localUser

  // Initialize room and media on mount
  useEffect(() => {
    if (!roomId) {
      navigate('/');
      setIsInitializing(false);
      return;
    }

    if (!localUser) {
      // Wait for localUser to be set - it will trigger this effect again when set
      // Set a safety timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        logger.warn('Local user not set after 2 seconds, proceeding anyway');
        setIsInitializing(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }

    const init = async () => {
      setConnectionStatus('connecting');

      try {
        const stream = await initializeMedia();
        if (stream) {
          initializePeerConnection(stream);
          // Socket connection and room join is handled by useSocket hook
        }
        // Always set initializing to false after attempting to initialize
        setIsInitializing(false);
      } catch (error) {
        logger.error('Failed to initialize:', error);
        // Error handling is done in useMedia hook (permissionError)
        setIsInitializing(false);
      }
    };

    init();

    return () => {
      cleanupMedia();
      cleanupWebRTC();
      cleanupAudio();
      // Don't call resetRoom here - it's handled in separate unmount effect
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, localUser?.id]); // Only depend on roomId and localUser.id to prevent loops

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      // Cleanup all timeouts
      timeoutRefs.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      timeoutRefs.current.clear();
      resetRoom();
    };
  }, []); // Empty deps - only runs on unmount

  const handleToggleScreenShare = useCallback(async () => {
    // Prevent double-clicks and concurrent operations
    if (isScreenShareLoading) {
      logger.warn('Screen share operation already in progress');
      return;
    }

    // BUG FIX: Only host can share screen
    // Check if current user is the host before allowing screen share
    if (localUser?.id !== hostId) {
      toast({
        title: 'Only host can share screen',
        description: 'You must be the host to share your screen.',
        variant: 'destructive',
      });
      return;
    }

    setIsScreenShareLoading(true);

    try {
      if (localUser?.mediaState.isScreenSharing) {
        // Remove screen share tracks from peer connection
        if (screenShareStream && webrtcRef.current) {
          await webrtcRef.current.removeScreenShareTrack(screenShareStream);
        }
        stopScreenShare();
        socket.emitHostChanged();
        toast({
          title: 'Screen sharing stopped',
          description: 'You are no longer sharing your screen.',
        });
      } else {
        const stream = await startScreenShare();
        if (stream) {
          // Add screen share tracks to peer connection
          // This will create a new offer and send it via socket
          if (webrtcRef.current) {
            await webrtcRef.current.addScreenShareTrack(stream);
          }
          socket.emitHostChanged();
          toast({
            title: 'Screen sharing started',
            description: 'Others can now see your screen.',
          });
        } else {
          // User cancelled screen share
          logger.log('Screen share cancelled by user');
        }
      }
    } catch (error) {
      logger.error('Failed to toggle screen share:', error);
      toast({
        title: 'Screen share error',
        description: error instanceof Error ? error.message : 'Failed to toggle screen sharing.',
        variant: 'destructive',
      });
    } finally {
      setIsScreenShareLoading(false);
    }
  }, [localUser?.mediaState.isScreenSharing, localUser?.id, hostId, screenShareStream, startScreenShare, stopScreenShare, socket, toast, isScreenShareLoading]);

  const handleLeaveRoom = useCallback(() => {
    cleanupMedia();
    cleanupWebRTC();
    cleanupAudio();
    resetRoom();
    navigate('/');
    toast({
      title: 'Left room',
      description: 'You have left the watch party.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupMedia, cleanupWebRTC, cleanupAudio, navigate, toast]); // resetRoom is stable, no need in deps

  const copyRoomLink = useCallback(async () => {
    try {
      const link = window.location.href;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      createTrackedTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link copied!',
        description: 'Share this link to invite someone.',
      });
    } catch (error) {
      logger.error('Failed to copy link:', error);
      toast({
        title: 'Failed to copy link',
        description: 'Please copy the URL manually from the address bar.',
        variant: 'destructive',
      });
    }
  }, [toast, createTrackedTimeout]);

  // Get host name for display
  const getHostName = () => {
    if (!hostId) return undefined;
    if (localUser?.id === hostId) return localUser.name;
    if (remoteUser?.id === hostId) return remoteUser.name;
    return 'Host';
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground">Setting up your camera and microphone...</p>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{permissionError}</AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Try Again
          </Button>
          <Button onClick={() => navigate('/')} variant="ghost">
            Go Back Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">ToForever</h1>
          <StatusBadge status={connectionStatus} />
        </div>
        <div className="flex items-center gap-3">
          {/* PiP Button */}
          <PipButton
            isPipActive={isPipActive}
            isPipSupported={isPipSupported}
            isPartnerAvailable={isPartnerAvailable}
            onClick={togglePip}
          />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
            <span className="text-sm text-muted-foreground">Room:</span>
            <span className="font-mono font-semibold text-foreground">{roomId}</span>
          </div>
          <ThemeToggle />
          <Button
            variant="secondary"
            size="sm"
            onClick={copyRoomLink}
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Invite'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Screen Share Area (70-75%) */}
        <div className="flex-[3] min-w-0">
          <ScreenPlayer
            stream={
              // BUG FIX: Show screen share from either local or remote host
              // Priority: local screen share (if local user is sharing) > remote screen share
              localUser?.mediaState.isScreenSharing && screenShareStream
                ? screenShareStream
                : screenShareStream // Remote screen share or local screen share
            }
            hostName={getHostName()}
          />
        </div>

        {/* Reaction Videos (25-30%) */}
        <div className="flex-1 flex flex-col gap-4 min-w-[280px] max-w-[350px]">
          {/* Local Video */}
          <VideoTile
            stream={localUser?.stream || null}
            label={localUser?.name || 'You'}
            isLocal
            isMuted={!localUser?.mediaState.isMicOn}
            isCameraOff={!localUser?.mediaState.isCameraOn}
            isHost={localUser?.id === hostId}
            className="flex-1"
          />

          {/* Remote Video - with ref for PiP functionality */}
          <VideoTile
            ref={remoteVideoRef}
            stream={remoteUser?.stream || null}
            label={remoteUser?.name || 'Waiting for friend...'}
            isMuted={!remoteUser?.mediaState.isMicOn}
            isCameraOff={!remoteUser?.mediaState.isCameraOn || !remoteUser}
            isHost={remoteUser?.id === hostId}
            isPipActive={isPipActive}
            className="flex-1"
          />
        </div>
      </main>

      {/* Control Bar */}
      <footer className="flex justify-center pb-6 px-4">
        <ControlBar
          isCameraOn={localUser?.mediaState.isCameraOn || false}
          isMicOn={localUser?.mediaState.isMicOn || false}
          isScreenSharing={localUser?.mediaState.isScreenSharing || false}
          isRemoteAudioMuted={isRemoteAudioMuted}
          isHost={localUser?.id === hostId}
          isScreenShareLoading={isScreenShareLoading}
          onToggleCamera={toggleCamera}
          onToggleMic={toggleMicrophone}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleRemoteAudio={toggleRemoteAudio}
          onLeaveRoom={handleLeaveRoom}
          onMicVolumeChange={handleMicVolumeChange}
          onMovieVolumeChange={setMovieVolume}
        />
      </footer>
    </div>
  );
};

export default Room;
