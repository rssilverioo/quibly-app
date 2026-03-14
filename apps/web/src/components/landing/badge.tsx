import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-violet-600 text-white',
        secondary: 'border-transparent bg-violet-100 text-violet-700',
        outline: 'text-gray-900 border-gray-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface LandingBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function LandingBadge({ className, variant, ...props }: LandingBadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { LandingBadge, badgeVariants };
