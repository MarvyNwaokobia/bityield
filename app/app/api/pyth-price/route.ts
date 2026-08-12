import { NextResponse } from 'next/server';

// Pyth price-feed ids the Zest sBTC oracle (stx-btc-oracle-v1-4) reads.
// A Zest withdraw must submit a fresh update for these in the same tx, or Zest
// reverts with "no-feed-update". Fetched server-side to avoid browser CORS and
// to keep the feed ids in one place.
const PYTH_FEED_IDS = {
  'STX/USD': 'ec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17',
  'BTC/USD': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
} as const;

const HERMES_BASE = process.env.PYTH_HERMES_URL ?? 'https://hermes.pyth.network';

// Returns the latest Pyth accumulator update (PNAU) for the feeds above as a hex
// string, ready to pass on-chain as the withdraw `price-feed-bytes` argument.
export async function GET() {
  const params = Object.values(PYTH_FEED_IDS)
    .map((id) => `ids%5B%5D=${id}`)
    .join('&');
  const url = `${HERMES_BASE}/v2/updates/price/latest?${params}&encoding=hex`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Pyth Hermes returned ${res.status}.` },
        { status: 502 }
      );
    }
    const data: { binary?: { data?: string[] } } = await res.json();
    const hex = data.binary?.data?.[0];
    if (!hex) {
      return NextResponse.json({ error: 'Pyth Hermes returned no update data.' }, { status: 502 });
    }
    return NextResponse.json({ hex });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Pyth price update.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
