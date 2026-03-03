import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-quibly-primary hover:bg-quibly-primary-light text-white',
      secondary: 'bg-quibly-surface-light hover:bg-quibly-border text-quibly-text',
      ghost: 'hover:bg-quibly-surface-light text-quibly-text-secondary',
      danger: 'bg-quibly-error/20 hover:bg-quibly-error/30 text-quibly-error',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
