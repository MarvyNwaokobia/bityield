import type { Transition, Variants } from 'framer-motion';

/** Snappy spring used for button/card hover and tap feedback. */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

/** Fade + slide used for step transitions and scroll reveals. */
export const fadeSlideUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2, ease: 'easeIn' } },
};

/** Wraps a list of `fadeSlideUp` children so they reveal one after another. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

export const hoverScale = { scale: 1.02 };
export const tapScale = { scale: 0.97 };
