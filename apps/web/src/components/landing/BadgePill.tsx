import { cn } from './utils';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'light' | 'dark';
  className?: string;
}

export default function BadgePill({ children, variant = 'light', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium',
        variant === 'dark'
          ? 'liquid-glass text-blue-200 border-white/15'
          : 'liquid-glass-card text-landing-blue',
        className,
      )}
    >
      {children}
    </span>
  );
}
