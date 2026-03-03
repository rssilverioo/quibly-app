import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-quibly-surface border border-quibly-border rounded-xl p-6',
        className,
      )}
      {...props}
    />
  );
}
