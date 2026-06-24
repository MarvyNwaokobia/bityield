'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  /** Stagger child `RevealItem`s in one-by-one instead of animating this element itself. */
  stagger?: boolean;
}

/** Fades + slides content in once it scrolls into view. */
export function RevealOnScroll({ children, className, stagger = false }: RevealOnScrollProps) {
  return (
    <motion.div
      className={className}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.2 }}
      variants={stagger ? staggerContainer : fadeSlideUp}
    >
      {children}
    </motion.div>
  );
}

/** A staggered child of a `RevealOnScroll` with `stagger`. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeSlideUp}>
      {children}
    </motion.div>
  );
}
