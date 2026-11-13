'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RouterTx } from '@/lib/stacks/analytics';
import { satsToBtc } from '@/lib/stacks/format';
import { explorerTxUrl } from '@/lib/stacks/network';
import { ArrowDownIcon, ArrowUpIcon, ExternalIcon } from './Icons';

export function strategyLabel(name: string | null): string {
  if (name === 'zest') return 'Zest Lending';
  if (name === 'hermetica') return 'Hermetica Structured';
  if (name === 'dual-stacking') return 'Dual Stacking';
  return 'Mock Yield';
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}

export function SectionHeader({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
      {href && (
        <Link href={href} className="text-sm text-bitcoin hover:underline">
          {action ?? 'See all'}
        </Link>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Chip({ tone, children, title }: { tone: 'orange' | 'green' | 'gray' | 'red'; children: ReactNode; title?: string }) {
  const tones = {
    orange: 'bg-bitcoin/10 text-bitcoin border-bitcoin/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    gray: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Round monogram for a strategy, used on rows and cards. */
export function StrategyAvatar({ name, className = 'w-10 h-10' }: { name: string; className?: string }) {
  const letter = strategyLabel(name).charAt(0);
  return (
    <span
      className={`shrink-0 flex items-center justify-center rounded-full bg-bitcoin/10 font-display font-bold text-bitcoin ${className}`}
    >
      {letter}
    </span>
  );
}

export function TxRow({ tx }: { tx: RouterTx }) {
  const isDeposit = tx.functionName === 'deposit';
  const failed = tx.status !== 'success';
  return (
    <a
      href={explorerTxUrl(tx.txid)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
    >
      <span
        className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${
          isDeposit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-bitcoin/10 text-bitcoin'
        }`}
      >
        {isDeposit ? <ArrowDownIcon className="w-4 h-4" /> : <ArrowUpIcon className="w-4 h-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium capitalize">
          {tx.functionName}
          {tx.strategy ? <span className="font-normal text-zinc-500"> · {strategyLabel(tx.strategy)}</span> : ''}
        </p>
        <p className="text-xs text-zinc-500">
          {formatWhen(tx.timeIso)} · {tx.sponsored ? 'Gas sponsored' : 'Self-paid'}
          {failed && <span className="text-red-400"> · {tx.status}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 text-right">
        <p className={`font-mono text-sm tabular-nums ${isDeposit ? 'text-white' : 'text-zinc-300'}`}>
          {tx.amountSats != null ? `${isDeposit ? '+' : ''}${satsToBtc(BigInt(tx.amountSats)).toFixed(8)}` : '-'}
        </p>
        <ExternalIcon className="w-3.5 h-3.5 text-zinc-600 transition-colors group-hover:text-bitcoin" />
      </div>
    </a>
  );
}

/** One label/value line inside a divided summary card. */
export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}
