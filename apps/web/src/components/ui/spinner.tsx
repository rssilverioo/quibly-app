import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-6 h-6 border-2 border-quibly-border border-t-quibly-primary rounded-full animate-spin',
        className,
      )}
    />
  );
}
