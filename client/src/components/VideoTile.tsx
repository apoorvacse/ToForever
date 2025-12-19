import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { VideoOff, Mic, MicOff, PictureInPicture2 } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isHost?: boolean;
  isPipActive?: boolean;
  className?: string;
}

export interface VideoTileRef {
  getVideoElement: () => HTMLVideoElement | null;
}

/**
 * VideoTile component that displays a webcam video stream
 * Supports forwarding the video ref for PiP functionality
 */
export const VideoTile = forwardRef<VideoTileRef, VideoTileProps>(({
  stream,
  label,
  isLocal = false,
  isMuted = false,
  isCameraOff = false,
  isHost = false,
  isPipActive = false,
  className,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose the video element to parent components for PiP
  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }), []);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-secondary border border-border transition-all duration-300',
        isHost && 'ring-2 ring-primary glow-primary',
        isPipActive && 'ring-2 ring-accent opacity-75',
        className
      )}
    >
      {/* Video element */}
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* PiP Active Indicator */}
      {isPipActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <PictureInPicture2 className="w-8 h-8 text-accent mx-auto" />
            <p className="text-sm text-muted-foreground">In Picture-in-Picture</p>
          </div>
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
            {label}
            {isLocal && ' (You)'}
          </span>
          {isHost && (
            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
              HOST
            </span>
          )}
        </div>
        
        {/* Mic indicator */}
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
            isMuted ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'
          )}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
});

VideoTile.displayName = 'VideoTile';
