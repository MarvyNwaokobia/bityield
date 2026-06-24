'use client';

import Link from 'next/link';
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { hoverScale, springTransition, tapScale } from '@/lib/motion';

const primaryClasses =
  'inline-flex items-center justify-center gap-2 bg-bitcoin text-black font-bold rounded-xl hover:bg-bitcoin-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

const secondaryClasses =
  'inline-flex items-center justify-center gap-2 border border-zinc-700 text-zinc-300 font-semibold rounded-xl hover:border-zinc-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

function Spinner({ className }: { className: string }) {
  return <span className={`w-4 h-4 rounded-full border-2 animate-spin ${className}`} />;
}

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  loading?: boolean;
  children?: ReactNode;
}

export function PrimaryButton({
  children,
  className = '',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileHover={isDisabled ? undefined : hoverScale}
      whileTap={isDisabled ? undefined : tapScale}
      transition={springTransition}
      disabled={isDisabled}
      className={`${primaryClasses} ${className}`}
      {...props}
    >
      {loading && <Spinner className="border-black/30 border-t-black" />}
      {children}
    </motion.button>
  );
}

export function SecondaryButton({
  children,
  className = '',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileHover={isDisabled ? undefined : hoverScale}
      whileTap={isDisabled ? undefined : tapScale}
      transition={springTransition}
      disabled={isDisabled}
      className={`${secondaryClasses} ${className}`}
      {...props}
    >
      {loading && <Spinner className="border-zinc-600 border-t-zinc-300" />}
      {children}
    </motion.button>
  );
}

const MotionLink = motion.create(Link);

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}

export function PrimaryLinkButton({ href, children, className = '', ...rest }: LinkButtonProps) {
  return (
    <MotionLink
      href={href}
      whileHover={hoverScale}
      whileTap={tapScale}
      transition={springTransition}
      className={`${primaryClasses} ${className}`}
      {...rest}
    >
      {children}
    </MotionLink>
  );
}

export function SecondaryLinkButton({ href, children, className = '', ...rest }: LinkButtonProps) {
  return (
    <MotionLink
      href={href}
      whileHover={hoverScale}
      whileTap={tapScale}
      transition={springTransition}
      className={`${secondaryClasses} ${className}`}
      {...rest}
    >
      {children}
    </MotionLink>
  );
}
