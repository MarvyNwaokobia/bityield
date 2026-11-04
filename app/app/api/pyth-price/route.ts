import { NextResponse } from 'next/server';

// Zest's sBTC oracle (stx-btc-oracle-v1-7) verifies a signed Pyth *Lazer* update,
// not the old Hermes/Wormhole one. A Zest withdraw must carry a fresh update in
// the same tx. Fetched server-side so the API key never reaches the browser.
//
// Lazer feed ids the oracle understands: BTC/USD = 1, STX/USD = 45.
// sBTC is priced from the BTC feed only, so by default we request just BTC.
// Set PYTH_LAZER_FEED_IDS="1,45" if a withdraw ever needs the STX price too
// (that requires an API key entitled to the STX/USD spot feed).
const LAZER_BASE = process.env.PYTH_LAZER_URL ?? 'https://pyth-lazer.dourolabs.app';
const PYTH_API_KEY = process.env.PYTH_API_KEY;
const FEED_IDS = (process.env.PYTH_LAZER_FEED_IDS ?? '1')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

// The oracle accepts channel 3 (fixed_rate@200ms) or 4 (fixed_rate@1000ms).
// Format must be "evm": it matches pyth-lazer-decoder-v1's envelope
// (magic 0x2a22999a, big-endian length, big-endian payload). "leEcdsa" is
// little-endian and fails to decode.
export async function GET() {
  if (!PYTH_API_KEY) {
    return NextResponse.json({ error: 'PYTH_API_KEY is not configured.' }, { status: 502 });
  }

  try {
    const res = await fetch(`${LAZER_BASE}/v1/latest_price`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PYTH_API_KEY}`,
      },
      body: JSON.stringify({
        priceFeedIds: FEED_IDS,
        properties: [
          'price',
          'exponent',
          'confidence',
          'publisherCount',
          'feedUpdateTimestamp',
        ],
        formats: ['evm'],
        channel: 'fixed_rate@200ms',
        jsonBinaryEncoding: 'hex',
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Pyth Lazer returned ${res.status}.` },
        { status: 502 }
      );
    }
    const data: { evm?: { data?: string } } = await res.json();
    const hex = data.evm?.data;
    if (!hex) {
      return NextResponse.json({ error: 'Pyth Lazer returned no update data.' }, { status: 502 });
    }
    return NextResponse.json({ hex });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Pyth price update.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
