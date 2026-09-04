import { NextResponse } from 'next/server';
import { logBetaEvent, type BetaEvent } from '@/lib/events';

const VALID_TYPES = new Set<BetaEvent['type']>(['wallet_connected', 'deposit_attempted', 'deposit_completed']);

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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ status: 'dropped' }, { status: 400 });
  }

  const { type, wallet, ref, strategy, amountSats, txid } = (payload ?? {}) as Record<string, unknown>;

  if (typeof type !== 'string' || !VALID_TYPES.has(type as BetaEvent['type'])) {
    return NextResponse.json({ status: 'dropped' }, { status: 400 });
  }

  await logBetaEvent({
    type: type as BetaEvent['type'],
    wallet: typeof wallet === 'string' ? wallet : undefined,
    ref: typeof ref === 'string' ? ref : undefined,
    strategy: typeof strategy === 'string' ? strategy : undefined,
    amountSats: typeof amountSats === 'number' ? amountSats : undefined,
    txid: typeof txid === 'string' ? txid : undefined,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ status: 'logged' });
}
