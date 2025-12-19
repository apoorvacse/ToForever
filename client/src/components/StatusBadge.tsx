import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'connected' | 'connecting' | 'disconnected';
  className?: string;
}

const statusConfig = {
  connected: {
    label: 'Connected',
    dotClass: 'bg-success',
    containerClass: 'border-success/30 text-success',
  },
  connecting: {
    label: 'Connecting...',
    dotClass: 'bg-primary animate-pulse',
    containerClass: 'border-primary/30 text-primary',
  },
  disconnected: {
    label: 'Disconnected',
    dotClass: 'bg-muted-foreground',
    containerClass: 'border-muted text-muted-foreground',
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border glass',
        config.containerClass,
        className
      )}
    >
      <span className={cn('w-2 h-2 rounded-full', config.dotClass)} />
      {config.label}
    </div>
  );
};
