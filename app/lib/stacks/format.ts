export const SATS_PER_BTC = 100_000_000;

export function satsToBtc(sats: bigint): number {
  return Number(sats) / SATS_PER_BTC;
}

export function formatBtc(sats: bigint, decimals = 8): string {
  return satsToBtc(sats).toFixed(decimals);
}
