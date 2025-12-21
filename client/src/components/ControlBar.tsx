import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  Volume2,
  VolumeX,
  PhoneOff,
  Settings,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState } from 'react';

interface ControlBarProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  isRemoteAudioMuted: boolean;
  isHost?: boolean; // BUG FIX: Add isHost prop to control screen share button
  isScreenShareLoading?: boolean; // Loading state for screen share
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onToggleRemoteAudio: () => void;
  onLeaveRoom: () => void;
  onMicVolumeChange?: (volume: number) => void;
  onMovieVolumeChange?: (volume: number) => void;
  className?: string;
}

export const ControlBar = ({
  isCameraOn,
  isMicOn,
  isScreenSharing,
  isRemoteAudioMuted,
  isHost = false,
  isScreenShareLoading = false,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onToggleRemoteAudio,
  onLeaveRoom,
  onMicVolumeChange,
  onMovieVolumeChange,
  className,
}: ControlBarProps) => {
  const [micVolume, setMicVolume] = useState(100);
  const [movieVolume, setMovieVolume] = useState(100);

  const handleMicVolumeChange = (value: number[]) => {
    setMicVolume(value[0]);
    onMicVolumeChange?.(value[0] / 100);
  };

  const handleMovieVolumeChange = (value: number[]) => {
    setMovieVolume(value[0]);
    onMovieVolumeChange?.(value[0] / 100);
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 p-4 glass rounded-2xl',
        className
      )}
    >
      {/* Camera toggle */}
      <Button
        variant={isCameraOn ? 'secondary' : 'destructive'}
        size="lg"
        onClick={onToggleCamera}
        className="w-12 h-12 rounded-full p-0"
        title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
      </Button>

      {/* Mic toggle */}
      <Button
        variant={isMicOn ? 'secondary' : 'destructive'}
        size="lg"
        onClick={onToggleMic}
        className="w-12 h-12 rounded-full p-0"
        title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </Button>

      {/* Screen share toggle - only enabled for host */}
      <Button
        variant={isScreenSharing ? 'default' : 'secondary'}
        size="lg"
        onClick={onToggleScreenShare}
        disabled={(!isHost && !isScreenSharing) || isScreenShareLoading} // Disable if not host, already sharing, or loading
        className={cn(
          'px-5 h-12 rounded-full gap-2',
          isScreenSharing && 'glow-primary animate-pulse-glow',
          (!isHost && !isScreenSharing) && 'opacity-50 cursor-not-allowed',
          isScreenShareLoading && 'opacity-75 cursor-wait'
        )}
        title={
          isScreenShareLoading
            ? 'Processing...'
            : !isHost && !isScreenSharing
            ? 'Only host can share screen'
            : isScreenSharing
            ? 'Stop sharing'
            : 'Share screen'
        }
      >
        {isScreenSharing ? (
          <>
            <MonitorX className="w-5 h-5" />
            <span className="font-medium">Stop Sharing</span>
          </>
        ) : (
          <>
            <MonitorUp className="w-5 h-5" />
            <span className="font-medium">Share Screen</span>
          </>
        )}
      </Button>

      {/* Remote audio toggle */}
      <Button
        variant={isRemoteAudioMuted ? 'destructive' : 'secondary'}
        size="lg"
        onClick={onToggleRemoteAudio}
        className="w-12 h-12 rounded-full p-0"
        title={isRemoteAudioMuted ? 'Unmute remote audio' : 'Mute remote audio'}
      >
        {isRemoteAudioMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </Button>

      {/* Volume settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="lg"
            className="w-12 h-12 rounded-full p-0"
            title="Audio settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" side="top" align="center">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Mic Volume
              </label>
              <Slider
                value={[micVolume]}
                onValueChange={handleMicVolumeChange}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MonitorUp className="w-4 h-4" />
                Movie Volume
              </label>
              <Slider
                value={[movieVolume]}
                onValueChange={handleMovieVolumeChange}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="w-px h-8 bg-border mx-2" />

      {/* Leave room */}
      <Button
        variant="destructive"
        size="lg"
        onClick={onLeaveRoom}
        className="px-5 h-12 rounded-full gap-2"
        title="Leave room"
      >
        <PhoneOff className="w-5 h-5" />
        <span className="font-medium">Leave</span>
      </Button>
    </div>
  );
};
