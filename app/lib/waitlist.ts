/**
 * Waitlist storage.
 *
 * Deliberately backend-agnostic: the API route only ever calls `addToWaitlist`,
 * so swapping providers is a change to this file and an env var, nothing else.
 *
 * Resolution order:
 *   1. Resend contacts  (RESEND_API_KEY)
 *   2. Generic webhook  (WAITLIST_WEBHOOK_URL) — Zapier / Make / Sheets / custom
 *   3. Local file       (development only)
 *
 * With nothing configured in production we return `unconfigured` rather than a
 * fake success. A waitlist that silently drops addresses is worse than no
 * waitlist, because you only find out at launch when the list is empty.
 */

export type WaitlistResult =
  | { status: 'added' }
  | { status: 'duplicate' }
  | { status: 'unconfigured' }
  | { status: 'error'; message: string };

const MAX_EMAIL_LENGTH = 254; // RFC 5321
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function addToWaitlist(email: string, source = 'landing'): Promise<WaitlistResult> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return addViaResend(email, resendKey);

  const webhook = process.env.WAITLIST_WEBHOOK_URL;
  if (webhook) return addViaWebhook(email, source, webhook);

  if (process.env.NODE_ENV !== 'production') return addToLocalFile(email, source);

  return { status: 'unconfigured' };
}

/**
 * Resend's contacts API.
 *
 * Verified against https://resend.com/docs/api-reference/contacts/create-contact
 * (checked 2026-07-29):
 *   - POST https://api.resend.com/contacts, no audience id in path or body.
 *     Current accounts have one built-in Audience; the older
 *     /audiences/{id}/contacts path is legacy.
 *   - `email` required; `unsubscribed` optional boolean.
 *   - Auth is `Bearer re_...`, and a User-Agent header is REQUIRED: Resend
 *     returns 403 without one. Node's fetch defaults to "node", but we set it
 *     explicitly rather than depend on an undocumented runtime default.
 *
 * Repeat signups are an upsert, not an error: "If a contact with the same email
 * address already exists, [it] will update the existing contact with the new
 * data ... applies to all import methods, API, CSV uploads, and manual
 * additions" (docs/dashboard/audiences/contacts). So a returning subscriber
 * gets a 2xx and we simply show success. The 409/text checks below are belt and
 * braces in case that behaviour changes.
 *
 * We deliberately do NOT send `unsubscribed: false`. Because the write is an
 * upsert, sending it would silently resubscribe anyone who had opted out, just
 * by their address being typed into the form again. Omitting the field leaves
 * an existing contact's choice untouched, and new contacts default to
 * subscribed.
 */
async function addViaResend(email: string, apiKey: string): Promise<WaitlistResult> {
  try {
    const res = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'bityield-waitlist/1.0 (+https://bityield.click)',
      },
      body: JSON.stringify({ email }),
    });

    if (res.ok) return { status: 'added' };

    const body = await res.text();

    // A returning subscriber must never see an error. Match narrowly though: a
    // false "duplicate" would drop a real signup while telling the person they
    // are on the list, which is the one failure we cannot detect later.
    if (res.status === 409 || /already\s+(exists|registered|subscribed)|duplicate/i.test(body)) {
      return { status: 'duplicate' };
    }

    if (res.status === 429) {
      console.error('[waitlist] resend rate limit hit', body);
      return { status: 'error', message: 'Rate limited by the email provider.' };
    }

    // 401 missing/restricted key, 403 invalid key or missing User-Agent, 422
    // validation. All are our misconfiguration, so make them loud in the logs.
    console.error('[waitlist] resend rejected the contact', res.status, body);
    return { status: 'error', message: `Resend responded ${res.status}` };
  } catch (err) {
    console.error('[waitlist] resend request failed', err);
    return { status: 'error', message: 'Could not reach the email provider.' };
  }
}

async function addViaWebhook(email: string, source: string, url: string): Promise<WaitlistResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, joinedAt: new Date().toISOString() }),
    });
    if (!res.ok) {
      console.error('[waitlist] webhook rejected the signup', res.status);
      return { status: 'error', message: `Webhook responded ${res.status}` };
    }
    return { status: 'added' };
  } catch (err) {
    console.error('[waitlist] webhook request failed', err);
    return { status: 'error', message: 'Could not reach the waitlist webhook.' };
  }
}

/** Development convenience so the form is testable without provisioning anything. */
async function addToLocalFile(email: string, source: string): Promise<WaitlistResult> {
  try {
    const { appendFile, readFile } = await import('node:fs/promises');
    const path = `${process.cwd()}/.waitlist.local.jsonl`;

    try {
      const existing = await readFile(path, 'utf8');
      if (existing.split('\n').some((line) => line.includes(`"email":"${email}"`))) {
        return { status: 'duplicate' };
      }
    } catch {
      // File does not exist yet, which is fine on the first signup.
    }

    await appendFile(path, `${JSON.stringify({ email, source, joinedAt: new Date().toISOString() })}\n`, 'utf8');
    console.warn(`[waitlist] dev mode: stored ${email} in .waitlist.local.jsonl (not a real backend)`);
    return { status: 'added' };
  } catch (err) {
    console.error('[waitlist] local file write failed', err);
    return { status: 'error', message: 'Could not write the local waitlist file.' };
  }
}
