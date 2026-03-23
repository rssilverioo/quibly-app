import Link from 'next/link';
import { cn } from './utils';
import type { ReactNode } from 'react';

interface Props {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'white';
  size?: 'md' | 'lg';
  className?: string;
}

export default function GradientButton({ href, children, variant = 'primary', size = 'md', className }: Props) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-blue';

  const variants = {
    primary: 'bg-landing-blue text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25 btn-shimmer',
    outline: 'liquid-glass text-white hover:bg-white/10',
    white: 'liquid-glass-light text-landing-text-dark hover:shadow-md',
  };

  const sizes = {
    md: 'h-11 px-6 text-sm',
    lg: 'h-14 px-8 text-base',
  };

  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
