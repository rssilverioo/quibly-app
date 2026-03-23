import { cn } from './utils';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

const dimensions = {
  sm: { width: 220, height: 440 },
  md: { width: 280, height: 560 },
};

export default function PhoneFrame({ children, className, size = 'md' }: Props) {
  const { width, height } = dimensions[size];

  return (
    <div className={cn('relative mx-auto', className)} style={{ width, height }}>
      {/* Outer bezel */}
      <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-b from-gray-700 to-gray-900 shadow-2xl" />
      {/* Screen area */}
      <div className="absolute inset-[4px] rounded-[2.75rem] bg-[#0A0A0F] overflow-hidden">
        {/* Notch / dynamic island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        {/* Content */}
        <div className="relative w-full h-full overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
