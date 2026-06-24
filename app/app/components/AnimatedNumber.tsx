'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
}

/** Tweens a numeric display value toward `value` whenever it changes. */
export function AnimatedNumber({ value, formatter = (n) => n.toString(), className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || displayRef.current === value) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    const controls = animate(displayRef.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (latest) => {
        displayRef.current = latest;
        setDisplay(latest);
      },
    });

    return () => controls.stop();
  }, [value, reducedMotion]);

  return <span className={className}>{formatter(display)}</span>;
}
