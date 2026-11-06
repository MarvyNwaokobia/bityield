'use client';

// Closed-beta attribution. Everything here is additive: the per-invitee `ref`
// code is captured exactly as before, and each event now also carries context
// the grant reviewers asked for (where a user came from, whether they came
// back, which anonymous visitor a wallet belongs to).
//
// Beta invite links carry a per-invitee code (e.g. bityield.click/?ref=alice)
// so a closed-beta funnel event can be tied back to who was invited without
// requiring anyone to pre-register a wallet address. Captured on landing and
// carried in localStorage across navigation to /deposit.
const REF_STORAGE_KEY = 'bityield.ref';
const VISITOR_KEY = 'bityield.vid'; // anonymous random id, links visits to a wallet once it connects
const FIRST_TOUCH_KEY = 'bityield.first_touch'; // where the visitor first came from, written once
const VISIT_COUNT_KEY = 'bityield.visits'; // number of sessions, for repeat-visit evidence
const SESSION_KEY = 'bityield.session'; // sessionStorage flag so a visit logs once per session

function read(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null; // private mode / blocked storage: attribution is best-effort
  }
}
function write(storage: 'local' | 'session', key: string, value: string): void {
  try {
    (storage === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // ignore
  }
}

interface FirstTouch {
  at: string;
  ref?: string;
  referrer?: string;
  landingPath: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

function currentTouch(): FirstTouch {
  const q = new URLSearchParams(window.location.search);
  return {
    at: new Date().toISOString(),
    ref: q.get('ref') ?? undefined,
    referrer: document.referrer || undefined,
    landingPath: window.location.pathname,
    utmSource: q.get('utm_source') ?? undefined,
    utmMedium: q.get('utm_medium') ?? undefined,
    utmCampaign: q.get('utm_campaign') ?? undefined,
  };
}

export function captureReferralFromUrl(): void {
  if (typeof window === 'undefined') return;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) write('local', REF_STORAGE_KEY, ref);
  if (!read('local', FIRST_TOUCH_KEY)) write('local', FIRST_TOUCH_KEY, JSON.stringify(currentTouch()));
}

function getReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return read('local', REF_STORAGE_KEY) ?? undefined;
}

function getVisitorId(): { id: string; isNew: boolean } | undefined {
  if (typeof window === 'undefined') return undefined;
  const existing = read('local', VISITOR_KEY);
  if (existing) return { id: existing, isNew: false };
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  write('local', VISITOR_KEY, id);
  return { id, isNew: true };
}

function getFirstTouch(): FirstTouch | undefined {
  const raw = read('local', FIRST_TOUCH_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as FirstTouch;
  } catch {
    return undefined;
  }
}

export type BetaEventType =
  | 'visit'
  | 'wallet_connected'
  | 'deposit_attempted'
  | 'deposit_completed'
  | 'deposit_failed'
  | 'withdraw_attempted'
  | 'withdraw_completed'
  | 'withdraw_failed';

interface BetaEventData {
  wallet?: string;
  strategy?: string;
  amountSats?: number;
  txid?: string;
  positionId?: number;
  /** For *_failed events: the outcome ('timeout', 'failed', 'error'). */
  reason?: string;
}

function post(body: Record<string, unknown>): void {
  try {
    fetch('/api/beta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore: a dropped analytics event must never break the real flow
  }
}

/** Context attached to every event. Existing fields (ref, wallet, txid...) are untouched. */
function context(): Record<string, unknown> {
  const first = getFirstTouch();
  return {
    ref: getReferralCode(),
    visitorId: getVisitorId()?.id,
    clientAt: new Date().toISOString(),
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    firstSeenAt: first?.at,
    firstRef: first?.ref,
    firstReferrer: first?.referrer,
    firstUtmSource: first?.utmSource,
    firstUtmMedium: first?.utmMedium,
    firstUtmCampaign: first?.utmCampaign,
  };
}

/** Fire-and-forget closed-beta funnel event. Never throws, never awaited by
 *  the caller: a dropped analytics event must never break the real flow. */
export function trackEvent(type: BetaEventType, data: BetaEventData = {}): void {
  if (typeof window === 'undefined') return;
  post({ type, ...context(), ...data });
}

/** One `visit` per browser session (not per page), with whether the visitor is
 *  returning and how many sessions they have had: the repeat-visit evidence. */
export function trackVisit(): void {
  if (typeof window === 'undefined') return;
  if (read('session', SESSION_KEY)) return;
  write('session', SESSION_KEY, '1');

  const visitor = getVisitorId();
  const visits = Number(read('local', VISIT_COUNT_KEY) ?? '0') + 1;
  write('local', VISIT_COUNT_KEY, String(visits));

  const touch = currentTouch();
  post({
    type: 'visit',
    ...context(),
    isReturning: visitor ? !visitor.isNew : undefined,
    visitCount: visits,
    landingPath: touch.landingPath,
    referrer: touch.referrer,
    utmSource: touch.utmSource,
    utmMedium: touch.utmMedium,
    utmCampaign: touch.utmCampaign,
  });
}
