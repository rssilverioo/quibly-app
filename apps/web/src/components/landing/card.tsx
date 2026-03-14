import * as React from 'react';
import { cn } from './utils';

const LandingCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border border-gray-200 bg-white text-gray-900 shadow', className)}
      {...props}
    />
  ),
);
LandingCard.displayName = 'LandingCard';

const LandingCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
LandingCardContent.displayName = 'LandingCardContent';

export { LandingCard, LandingCardContent };
