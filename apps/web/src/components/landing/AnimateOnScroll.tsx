'use client';

import { useRef } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type AnimVariant = 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right';

const animVariants: Record<AnimVariant, Variants> = {
  'fade-up': {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0 },
  },
  'fade-in': {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  'slide-left': {
    hidden: { opacity: 0, x: -48 },
    visible: { opacity: 1, x: 0 },
  },
  'slide-right': {
    hidden: { opacity: 0, x: 48 },
    visible: { opacity: 1, x: 0 },
  },
};

interface Props {
  children: ReactNode;
  variant?: AnimVariant;
  delay?: number;
  duration?: number;
  className?: string;
}

export default function AnimateOnScroll({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0.6,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null!);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const v = animVariants[variant];

  const mergedVariants: Variants = {
    hidden: v.hidden,
    visible: {
      ...(v.visible as object),
      transition: { duration, delay, ease: 'easeOut' },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={mergedVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
