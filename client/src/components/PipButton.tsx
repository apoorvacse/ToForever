import { PictureInPicture2, MonitorUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PipButtonProps {
  isPipActive: boolean;
  isPipSupported: boolean;
  isPartnerAvailable: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Button to toggle Picture-in-Picture mode for partner's video
 * Shows different states: active, inactive, disabled
 */
export const PipButton = ({
  isPipActive,
  isPipSupported,
  isPartnerAvailable,
  onClick,
  className,
}: PipButtonProps) => {
  const isDisabled = !isPipSupported || !isPartnerAvailable;

  const getTooltipContent = () => {
    if (!isPipSupported) {
      return 'Picture-in-Picture is not supported in your browser';
    }
    if (!isPartnerAvailable) {
      return 'Partner camera is not available';
    }
    if (isPipActive) {
      return 'Return partner video to the app';
    }
    return 'Pop partner video into a floating window to watch while in other tabs';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isPipActive ? 'default' : 'secondary'}
            size="sm"
            onClick={onClick}
            disabled={isDisabled}
            className={cn(
              'gap-2 transition-all duration-200',
              isPipActive && 'bg-accent text-accent-foreground hover:bg-accent/90',
              className
            )}
          >
            {isPipActive ? (
              <>
                <MonitorUp className="w-4 h-4" />
                Return to App
              </>
            ) : (
              <>
                <PictureInPicture2 className="w-4 h-4" />
                Pop Partner Video
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px] text-center">
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
