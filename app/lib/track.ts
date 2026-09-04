'use client';

// Beta invite links carry a per-invitee code (e.g. bityield.click/?ref=alice)
// so a closed-beta funnel event can be tied back to who was invited without
// requiring anyone to pre-register a wallet address. Captured once on
// landing and carried in localStorage across navigation to /deposit.
const REF_STORAGE_KEY = 'bityield.ref';

export function captureReferralFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) window.localStorage.setItem(REF_STORAGE_KEY, ref);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies) — beta
    // attribution is best-effort and must never block the app.
  }
}

function getReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(REF_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export type BetaEventType = 'wallet_connected' | 'deposit_attempted' | 'deposit_completed';

interface BetaEventData {
  wallet?: string;
  strategy?: string;
  amountSats?: number;
  txid?: string;
}

/** Fire-and-forget closed-beta funnel event. Never throws, never awaited by
 *  the caller — a dropped analytics event must never break the real flow. */
export function trackEvent(type: BetaEventType, data: BetaEventData = {}): void {
  try {
    const body = JSON.stringify({ type, ref: getReferralCode(), ...data });
    fetch('/api/beta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — see above
  }
}
