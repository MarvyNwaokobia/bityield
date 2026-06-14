'use client';

import type { ReactNode } from 'react';
import type { TxPhase } from '@/lib/stacks/tx';

export const PHASE_COPY: Record<TxPhase, { title: string; subtitle: string }> = {
  signing: {
    title: 'Waiting for approval',
    subtitle: 'Confirm the transaction in your wallet to continue.',
  },
  sponsoring: {
    title: 'Submitting your transaction',
    subtitle: 'Covering the network fee and broadcasting — this is automatic.',
  },
  confirming: {
    title: 'Confirming on the network',
    subtitle: 'This usually takes about a minute.',
  },
};

export function PendingCard({ phase, footer }: { phase: TxPhase; footer?: ReactNode }) {
  const { title, subtitle } = PHASE_COPY[phase];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 border-4 border-zinc-700 border-t-[#F7931A] rounded-full animate-spin" />
      </div>
      <p className="text-xl font-semibold mb-2">{title}</p>
      <p className="text-zinc-400 mb-6">{subtitle}</p>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full w-2/3 bg-[#F7931A] animate-pulse" />
      </div>
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-full bg-[#F7931A]/10 border border-[#F7931A] flex items-center justify-center text-2xl text-[#F7931A]">
          ✓
        </div>
      </div>
      <p className="text-xl font-semibold mb-2">{title}</p>
      <p className="text-zinc-400 mb-8 leading-relaxed">{description}</p>
      {children}
      <button
        type="button"
        onClick={onDone}
        className="w-full bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
      >
        {doneLabel}
      </button>
    </div>
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
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center text-2xl text-red-500">
          !
        </div>
      </div>
      <p className="text-xl font-semibold mb-2">{title}</p>
      <p className="text-zinc-400 mb-8 leading-relaxed">{description}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-zinc-700 text-zinc-300 font-semibold px-6 py-4 rounded-xl hover:border-zinc-500 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
        >
          {retryLabel}
        </button>
      </div>
    </div>
  );
}
