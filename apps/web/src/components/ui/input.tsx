import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-quibly-surface-light border border-quibly-border rounded-lg px-4 py-2.5 text-sm text-quibly-text placeholder:text-quibly-text-muted focus:outline-none focus:ring-2 focus:ring-quibly-primary focus:border-transparent transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
