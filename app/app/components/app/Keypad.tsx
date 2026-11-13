'use client';

import { useEffect } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/** Applies one keypress to an amount string, capped at 8 decimals (sat precision). */
export function applyAmountKey(prev: string, key: string): string {
  if (key === 'back') return prev.length > 1 ? prev.slice(0, -1) : '0';
  if (key === '.') return prev.includes('.') ? prev : `${prev}.`;
  if (!/^\d$/.test(key)) return prev;
  if (prev === '0') return key;
  const dot = prev.indexOf('.');
  if (dot !== -1 && prev.length - dot - 1 >= 8) return prev;
  if (prev.length >= 18) return prev;
  return prev + key;
}

/**
 * On-screen number pad. Also listens to the physical keyboard while `active`,
 * so desktop users can just type.
 */
export function Keypad({ onKey, active = true }: { onKey: (key: string) => void; active?: boolean }) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) onKey(e.key);
      else if (e.key === '.' || e.key === ',') onKey('.');
      else if (e.key === 'Backspace') onKey('back');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onKey]);

  return (
    <div className="grid grid-cols-3 gap-y-1">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Delete' : k === '.' ? 'Decimal point' : k}
          className="flex h-14 select-none items-center justify-center rounded-xl font-display text-2xl font-medium text-zinc-100 transition-colors active:bg-surface-2"
        >
          {k === 'back' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-zinc-400">
              <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9l-5 6m0-6 5 6" />
            </svg>
          ) : (
            k
          )}
        </button>
      ))}
    </div>
  );
}
