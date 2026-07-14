import { HIRO_API_URL, SBTC_TOKEN } from './network';

/**
 * Reads the user's sBTC balance in sats.
 *
 * Uses the Hiro Extended REST API (`/extended/v1/address/{addr}/balances`),
 * which returns balances as plain JSON — no Clarity deserialization and no
 * dependency on `@stacks/transactions` at runtime. An earlier version called
 * the token contract's SIP-010 `get-balance` via `fetchCallReadOnlyFunction`,
 * but the `ClarityType` enum that path relies on gets tree-shaken out of the
 * production bundle, so the read silently returned 0. This endpoint sidesteps
 * that entirely (it's the same one the sponsor-health check and tx history use).
 *
 * Returns 0n when the token contract isn't configured, or when the wallet
 * genuinely holds no sBTC. Throws only when the read itself fails (network /
 * non-2xx), so callers can tell "empty wallet" apart from "couldn't load" and
 * never falsely claim the user has no sBTC.
 */
export async function getSbtcBalanceSats(address: string): Promise<bigint> {
  if (!SBTC_TOKEN) return 0n;

  const res = await fetch(`${HIRO_API_URL}/extended/v1/address/${address}/balances`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Balance read failed: ${res.status} ${res.statusText}`);
  }

  const data: { fungible_tokens?: Record<string, { balance?: string }> } = await res.json();
  const tokens = data.fungible_tokens ?? {};

  // Balances are keyed by `<contract-address>.<contract-name>::<asset-name>`.
  // Match on the contract id prefix so we don't depend on the asset name.
  const prefix = `${SBTC_TOKEN.address}.${SBTC_TOKEN.name}::`;
  for (const [assetId, info] of Object.entries(tokens)) {
    if (assetId.startsWith(prefix)) {
      return BigInt(info.balance ?? '0');
    }
  }

  // Token not present in the wallet's ledger — a genuine zero balance.
  return 0n;
}
