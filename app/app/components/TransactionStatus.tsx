'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { TxPhase } from '@/lib/stacks/tx';
import { fadeSlideUp, springTransition, staggerContainer } from '@/lib/motion';
import { PrimaryButton, SecondaryButton } from './Button';

export const PHASE_COPY: Record<TxPhase, { title: string; subtitle: string }> = {
  signing: {
    title: 'Waiting for approval',
    subtitle: 'Confirm the transaction in your wallet to continue.',
  },
  sponsoring: {
    title: 'Submitting your transaction',
    subtitle: 'Covering the network fee and broadcasting. This is automatic.',
  },
  confirming: {
    title: 'Confirming on the network',
    subtitle: 'Your transaction is live, waiting for on-chain finality, usually 30 to 60 seconds.',
  },
};

const PHASE_ORDER: TxPhase[] = ['signing', 'sponsoring', 'confirming'];

const STEP_LABELS: Record<TxPhase, string> = {
  signing: 'Approve',
  sponsoring: 'Submit',
  confirming: 'Confirm',
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <motion.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
      />
    </svg>
  );
}

function StepCircle({ status }: { status: 'done' | 'active' | 'upcoming' }) {
  if (status === 'done') {
    return (
      <motion.div
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={springTransition}
        className="w-8 h-8 rounded-full bg-bitcoin flex items-center justify-center text-black"
      >
        <CheckIcon className="w-4 h-4" />
      </motion.div>
    );
  }
  if (status === 'active') {
    return (
      <div className="relative w-8 h-8 rounded-full border-2 border-bitcoin/20 shadow-[0_0_16px_-2px_rgba(247,147,26,0.6)]">
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-bitcoin animate-spin" />
      </div>
    );
  }
  return <div className="w-8 h-8 rounded-full border-2 border-zinc-700" />;
}

export function PendingCard({
  phase,
  footer,
  explorerUrl,
}: {
  phase: TxPhase;
  footer?: ReactNode;
  explorerUrl?: string;
}) {
  const { title, subtitle } = PHASE_COPY[phase];
  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <div className="flex items-center justify-center mb-8">
        {PHASE_ORDER.map((p, i) => (
          <div key={p} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <StepCircle status={i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming'} />
              <span
                className={`text-xs uppercase tracking-widest ${
                  i <= currentIndex ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                {STEP_LABELS[p]}
              </span>
            </div>
            {i < PHASE_ORDER.length - 1 && (
              <div className="w-10 sm:w-14 h-0.5 mx-1 mb-6 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-bitcoin"
                  initial={{ width: 0 }}
                  animate={{ width: i < currentIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="font-display text-xl font-semibold mb-2">{title}</p>
      <p className="text-zinc-400">{subtitle}</p>

      {phase === 'confirming' && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-sm text-bitcoin/90 hover:text-bitcoin hover:underline"
        >
          Watch it confirm on the explorer ↗
        </a>
      )}

      {footer && <p className="text-zinc-600 text-sm mt-6">{footer}</p>}
    </div>
  );
}

export function SuccessCard({
  title,
  description,
  children,
  onDone,
  doneLabel = 'Done',
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  onDone: () => void;
  doneLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springTransition}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...springTransition, delay: 0.1 }}
        className="flex justify-center mb-6"
      >
        <div className="w-14 h-14 rounded-full bg-bitcoin/10 border border-bitcoin flex items-center justify-center text-bitcoin shadow-[0_0_24px_-4px_rgba(247,147,26,0.6)]">
          <CheckIcon className="w-6 h-6" />
        </div>
      </motion.div>
      <motion.div initial="initial" animate="animate" variants={staggerContainer}>
        <motion.p variants={fadeSlideUp} className="font-display text-xl font-semibold mb-2">
          {title}
        </motion.p>
        <motion.p variants={fadeSlideUp} className="text-zinc-400 mb-8 leading-relaxed">
          {description}
        </motion.p>
        {children && <motion.div variants={fadeSlideUp}>{children}</motion.div>}
        <motion.div variants={fadeSlideUp}>
          <PrimaryButton onClick={onDone} className="w-full px-6 py-4">
            {doneLabel}
          </PrimaryButton>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export function ErrorCard({
  title,
  description,
  onCancel,
  onRetry,
  cancelLabel = 'Cancel',
  retryLabel = 'Try Again',
}: {
  title: string;
  description: ReactNode;
  onCancel: () => void;
  onRetry: () => void;
  cancelLabel?: string;
  retryLabel?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: reducedMotion ? 0 : [0, -8, 8, -8, 8, 0] }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
    >
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center text-2xl text-red-500 shadow-[0_0_24px_-4px_rgba(239,68,68,0.55)]">
          !
        </div>
      </div>
      <p className="font-display text-xl font-semibold mb-2">{title}</p>
      <p className="text-zinc-400 mb-8 leading-relaxed">{description}</p>
      <div className="flex gap-3">
        <SecondaryButton onClick={onCancel} className="flex-1 px-6 py-4">
          {cancelLabel}
        </SecondaryButton>
        <PrimaryButton onClick={onRetry} className="flex-1 px-6 py-4">
          {retryLabel}
        </PrimaryButton>
      </div>
    </motion.div>
  );
}
