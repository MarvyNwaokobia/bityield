/**
 * Closed-beta funnel event logging.
 *
 * Deliberately mirrors the waitlist backend-agnostic pattern (see
 * lib/waitlist.ts): the API route only ever calls `logBetaEvent`, so plugging
 * in a real destination (a Google Sheet via Apps Script/Zapier, or anything
 * else that accepts a JSON POST) is an env var change, nothing else.
 *
 * Resolution order:
 *   1. Generic webhook (BETA_EVENTS_WEBHOOK_URL) — Zapier / Make / Sheets / custom
 *   2. Local file       (development only)
 *
 * Unlike the waitlist, an unconfigured destination in production does not
 * error the caller — a dropped analytics event must never surface to a real
 * beta user as a broken deposit flow.
 */

export interface BetaEvent {
  type: 'wallet_connected' | 'deposit_attempted' | 'deposit_completed';
  wallet?: string;
  ref?: string;
  strategy?: string;
  amountSats?: number;
  txid?: string;
  at: string;
}

export async function logBetaEvent(event: BetaEvent): Promise<void> {
  const webhook = process.env.BETA_EVENTS_WEBHOOK_URL;
  if (webhook) return logViaWebhook(event, webhook);

  if (process.env.NODE_ENV !== 'production') return logToLocalFile(event);

  console.warn('[beta-event] no BETA_EVENTS_WEBHOOK_URL configured; event dropped', event.type);
}

async function logViaWebhook(event: BetaEvent, url: string): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) console.error('[beta-event] webhook rejected the event', res.status);
  } catch (err) {
    console.error('[beta-event] webhook request failed', err);
  }
}

/** Development convenience so the funnel is testable without provisioning anything. */
async function logToLocalFile(event: BetaEvent): Promise<void> {
  try {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(`${process.cwd()}/.beta-events.local.jsonl`, `${JSON.stringify(event)}\n`, 'utf8');
  } catch (err) {
    console.error('[beta-event] local file write failed', err);
  }
}
