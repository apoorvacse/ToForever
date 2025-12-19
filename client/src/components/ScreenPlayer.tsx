import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MonitorOff, Play } from 'lucide-react';

interface ScreenPlayerProps {
  stream: MediaStream | null;
  hostName?: string;
  className?: string;
}

export const ScreenPlayer = ({ stream, hostName, className }: ScreenPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

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
        'relative overflow-hidden rounded-2xl bg-card border border-border h-full',
        className
      )}
    >
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-background"
          />
          {/* Host indicator */}
          {hostName && (
            <div className="absolute top-4 left-4 px-3 py-1.5 glass rounded-lg flex items-center gap-2">
              <Play className="w-3 h-3 text-primary fill-primary" />
              <span className="text-sm font-medium">{hostName} is sharing</span>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
            <MonitorOff className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No Screen Shared</h3>
          <p className="text-muted-foreground text-center max-w-md px-4">
            Click "Share Screen" to start watching together. The shared screen will appear here.
          </p>
        </div>
      )}
    </div>
  );
};
