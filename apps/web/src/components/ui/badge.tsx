import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'pro';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-quibly-surface-light text-quibly-text-secondary',
    success: 'bg-quibly-success/20 text-quibly-success',
    warning: 'bg-quibly-warning/20 text-quibly-warning',
    error: 'bg-quibly-error/20 text-quibly-error',
    pro: 'bg-quibly-primary/20 text-quibly-primary-light',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
