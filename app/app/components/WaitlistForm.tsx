'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PrimaryButton } from './Button';

type Status = 'idle' | 'submitting' | 'success' | 'duplicate';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-7 h-7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export function WaitlistForm({ source = 'landing' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const isDone = status === 'success' || status === 'duplicate';

  // Validate on blur rather than on every keystroke, so we don't scold someone
  // who is still halfway through typing their address.
  function handleBlur() {
    if (email && !EMAIL_PATTERN.test(email.trim())) {
      setError('That does not look like a valid email address. Check for a typo.');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setError('Enter your email address so we know where to reach you.');
      inputRef.current?.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('That does not look like a valid email address. Check for a typo.');
      inputRef.current?.focus();
      return;
    }

    setStatus('submitting');
    setError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source,
          website: (document.getElementById('wl-company') as HTMLInputElement | null)?.value ?? '',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('idle');
        setError(data.error ?? 'Something went wrong. Please try again.');
        inputRef.current?.focus();
        return;
      }

      setStatus(data.status === 'duplicate' ? 'duplicate' : 'success');
    } catch {
      setStatus('idle');
      setError('Could not reach the server. Check your connection and try again.');
      inputRef.current?.focus();
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isDone ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4 text-left"
        >
          <span className="text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle />
          </span>
          <div>
            <p className="font-display font-semibold text-white">
              {status === 'duplicate' ? 'You were already on the list' : "You're on the list"}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              We&rsquo;ll email you the moment early access opens. Nothing else, and never your inbox sold on.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          noValidate
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-left"
        >
          <label htmlFor="waitlist-email" className="block text-sm font-medium text-zinc-300 mb-2">
            Email address
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={inputRef}
              id="waitlist-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              onBlur={handleBlur}
              placeholder="you@example.com"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'waitlist-error' : 'waitlist-hint'}
              disabled={status === 'submitting'}
              className="flex-1 min-w-0 rounded-xl border bg-zinc-900/80 px-5 py-3.5 text-base text-white placeholder-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-bitcoin/40 disabled:opacity-50 border-zinc-700 focus:border-bitcoin aria-invalid:border-red-500/70 aria-invalid:focus:ring-red-500/30"
            />

            {/* Honeypot: hidden from people and assistive tech, catnip for bots. */}
            <input
              id="wl-company"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />

            <PrimaryButton
              type="submit"
              loading={status === 'submitting'}
              className="px-7 py-3.5 text-base whitespace-nowrap"
            >
              {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
            </PrimaryButton>
          </div>

          {error ? (
            <p id="waitlist-error" role="alert" className="mt-2.5 text-sm text-red-400">
              {error}
            </p>
          ) : (
            <p id="waitlist-hint" className="mt-2.5 text-sm text-zinc-500">
              One email when we launch. No newsletter, no spam, unsubscribe anytime.
            </p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
