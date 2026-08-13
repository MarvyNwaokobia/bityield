export const SATS_PER_BTC = 100_000_000;

export function satsToBtc(sats: bigint): number {
  return Number(sats) / SATS_PER_BTC;
}

export function formatBtc(sats: bigint, decimals = 8): string {
  return satsToBtc(sats).toFixed(decimals);
}

// Formats a display percent (e.g. 4.5 means 4.5%) for a live-read APY, which
// can be genuinely tiny (Zest's real sBTC supply rate can sit near zero when
// pool utilization is low). Plain toFixed(1) would round that to "0.0%",
// which reads as broken rather than as an honest near-zero rate.
export function formatApyPercent(percent: number): string {
  if (percent <= 0) return '0%';
  if (percent < 0.01) return '<0.01%';
  if (percent < 1) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(1)}%`;
}
