'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * Full-screen frame for deposit and withdraw. No tab bar: the flow owns the
 * screen, with a back/close button, a title, a progress bar, and a sticky
 * action area at the bottom.
 */
export function FlowShell({
  title,
  step,
  total,
  onBack,
  backHref = '/dashboard',
  close,
  footer,
  children,
}: {
  title: string;
  step?: number;
  total?: number;
  /** Goes back inside the flow. Omit to leave the flow via backHref. */
  onBack?: () => void;
  backHref?: string;
  /** Show an X instead of a back arrow (final screens). */
  close?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const buttonClass =
    'flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-surface-2 hover:text-white';
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-lg">
        <div className="mx-auto grid w-full max-w-md grid-cols-[2.5rem_1fr_2.5rem] items-center px-3 py-3">
          {onBack && !close ? (
            <button type="button" onClick={onBack} aria-label="Back" className={buttonClass}>
              <BackIcon />
            </button>
          ) : (
            <Link href={backHref} aria-label={close ? 'Close' : 'Back'} className={buttonClass}>
              {close ? <CloseIcon /> : <BackIcon />}
            </Link>
          )}
          <h1 className="text-center font-display text-base font-semibold">{title}</h1>
          <span />
        </div>
        {step && total ? (
          <div className="mx-auto flex w-full max-w-md gap-1.5 px-4 pb-2" role="progressbar" aria-valuenow={step} aria-valuemax={total}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-bitcoin' : 'bg-line'}`} />
            ))}
          </div>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4 pb-6">{children}</main>

      {footer && (
        <div className="sticky bottom-0 z-30 border-t border-line bg-[#0a0a0a]/95 backdrop-blur-lg safe-bottom">
          <div className="mx-auto w-full max-w-md px-4 py-3">{footer}</div>
        </div>
      )}
    </div>
  );
}
