// Fetches a fresh Pyth price update (via our /api/pyth-price route) for the
// Zest withdraw `price-feed-bytes` argument. Zest reverts a withdraw that does
// not carry a fresh update, so this must run right before submitting a Zest
// withdraw. Returns the update as raw bytes, or throws with a clear message.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Malformed Pyth update hex.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function fetchPythPriceFeedBytes(): Promise<Uint8Array> {
  const res = await fetch('/api/pyth-price', { cache: 'no-store' });
  const data: { hex?: string; error?: string } = await res.json();
  if (!res.ok || !data.hex) {
    throw new Error(data.error ?? 'Could not fetch a fresh Pyth price update for withdrawal.');
  }
  return hexToBytes(data.hex);
}
