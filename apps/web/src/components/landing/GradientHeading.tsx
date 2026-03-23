import { cn } from './utils';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  gradient?: boolean;
}

export default function GradientHeading({ children, as: Tag = 'h2', className, gradient = false }: Props) {
  return (
    <Tag
      className={cn(
        'font-display font-bold tracking-tight',
        gradient && 'bg-gradient-to-r from-white via-blue-200 to-blue-400 bg-clip-text text-transparent',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
