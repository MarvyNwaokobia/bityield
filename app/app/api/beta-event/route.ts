import { NextResponse } from 'next/server';
import { logBetaEvent, type BetaEvent } from '@/lib/events';

const VALID_TYPES = new Set<BetaEvent['type']>([
  'visit',
  'wallet_connected',
  'deposit_attempted',
  'deposit_completed',
  'deposit_failed',
  'withdraw_attempted',
  'withdraw_completed',
  'withdraw_failed',
]);

/** Accept only short strings so a caller cannot bloat the log. */
const str = (v: unknown, max = 300): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Best-effort in-process throttle. Resets on cold start, so it deters casual
 *  spam rather than a determined attacker. Same pattern as /api/waitlist. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (hits.size > 5_000) {
      for (const [key, value] of hits) if (now > value.resetAt) hits.delete(key);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// This endpoint intentionally never reports failure beyond a plain status
// code: it is fire-and-forget analytics for the closed beta, and a caller
// (the deposit/wallet-connect flow) must never treat a dropped event as
// something to retry or surface to the user.
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ status: 'dropped' }, { status: 429 });
  }

  // Read the body as text first so the exact bytes received can be stored as `raw`.
  let rawBody: string;
  let payload: unknown;
  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: 'dropped' }, { status: 400 });
  }

  const p = (payload ?? {}) as Record<string, unknown>;
  const { type } = p;

  if (typeof type !== 'string' || !VALID_TYPES.has(type as BetaEvent['type'])) {
    return NextResponse.json({ status: 'dropped' }, { status: 400 });
  }

  await logBetaEvent({
    type: type as BetaEvent['type'],
    // original fields, parsed exactly as before
    wallet: typeof p.wallet === 'string' ? p.wallet : undefined,
    ref: typeof p.ref === 'string' ? p.ref : undefined,
    strategy: typeof p.strategy === 'string' ? p.strategy : undefined,
    amountSats: typeof p.amountSats === 'number' ? p.amountSats : undefined,
    txid: typeof p.txid === 'string' ? p.txid : undefined,
    at: new Date().toISOString(),
    // added context
    positionId: num(p.positionId),
    reason: str(p.reason, 40),
    visitorId: str(p.visitorId, 64),
    clientAt: str(p.clientAt, 40),
    path: str(p.path, 200),
    firstSeenAt: str(p.firstSeenAt, 40),
    firstRef: str(p.firstRef, 100),
    firstReferrer: str(p.firstReferrer),
    firstUtmSource: str(p.firstUtmSource, 100),
    firstUtmMedium: str(p.firstUtmMedium, 100),
    firstUtmCampaign: str(p.firstUtmCampaign, 100),
    isReturning: typeof p.isReturning === 'boolean' ? p.isReturning : undefined,
    visitCount: num(p.visitCount),
    landingPath: str(p.landingPath, 200),
    referrer: str(p.referrer),
    utmSource: str(p.utmSource, 100),
    utmMedium: str(p.utmMedium, 100),
    utmCampaign: str(p.utmCampaign, 100),
    // observed by the server, not supplied by the client
    userAgent: str(request.headers.get('user-agent'), 300),
    country: str(request.headers.get('x-vercel-ip-country'), 8),
    raw: rawBody.slice(0, 4000),
  });

  return NextResponse.json({ status: 'logged' });
}
