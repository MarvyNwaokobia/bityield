import { NextResponse } from 'next/server';
import { addToWaitlist, isValidEmail, normalizeEmail } from '@/lib/waitlist';

/** Best-effort in-process throttle. Resets on cold start, so it deters casual
 *  spam rather than a determined attacker. Move to Redis if that changes. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
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

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const { email, website, source } = (payload ?? {}) as {
    email?: unknown;
    website?: unknown;
    source?: unknown;
  };

  // Honeypot: real people leave a hidden field empty. Accept silently so bots
  // get no signal about why they failed.
  if (typeof website === 'string' && website.length > 0) {
    return NextResponse.json({ status: 'added' });
  }

  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Enter your email address.' }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return NextResponse.json(
      { error: 'That does not look like a valid email address. Check for a typo.' },
      { status: 400 }
    );
  }

  const result = await addToWaitlist(normalized, typeof source === 'string' ? source : 'landing');

  switch (result.status) {
    case 'added':
    case 'duplicate':
      return NextResponse.json({ status: result.status });
    case 'unconfigured':
      console.error('[waitlist] no storage backend configured; signup was dropped');
      return NextResponse.json(
        { error: 'The waitlist is not available right now. Please try again later.' },
        { status: 503 }
      );
    default:
      return NextResponse.json(
        { error: 'Something went wrong saving your email. Please try again.' },
        { status: 502 }
      );
  }
}
