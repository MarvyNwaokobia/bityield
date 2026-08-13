import { uintCV, principalCV, hexToCV, type TupleCV, type UIntCV } from '@stacks/transactions';
import { fetchCallReadOnlyFunction } from '@stacks/transactions';
import { network, YIELD_ROUTER, HIRO_API_URL, STRATEGIES, type StrategyName } from './network';
import { CT, cvType } from './clarity-runtime';

export const DEFAULT_APY_BPS = 500; // 5.00% — matches the contract's default and the landing page.

export interface RateInfo {
  strategy: string;
  apyBps: number;
  tvlSats: bigint;
}

const DEFAULT_RATE: RateInfo = { strategy: 'mock-yield', apyBps: DEFAULT_APY_BPS, tvlSats: 0n };

function asUint(value: UIntCV): bigint {
  return BigInt(value.value);
}

/**
 * Reads YieldRouter's current rate. Falls back to the contract's default (5%)
 * if NEXT_PUBLIC_YIELD_ROUTER_ADDRESS is unset or the read fails, so the UI
 * stays usable before the contract is deployed.
 */
export async function getBestRate(): Promise<RateInfo> {
  if (!YIELD_ROUTER) return DEFAULT_RATE;

  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: YIELD_ROUTER.address,
      contractName: YIELD_ROUTER.name,
      functionName: 'get-best-rate',
      functionArgs: [],
      senderAddress: YIELD_ROUTER.address,
      network,
    });

    if (cvType(result) === CT.tuple) {
      const value = (result as TupleCV).value;
      const strategy = value.strategy;
      const apyBps = value['apy-bps'];
      const tvl = value.tvl;
      if (
        cvType(strategy) === CT.ascii &&
        cvType(apyBps) === CT.uint &&
        cvType(tvl) === CT.uint
      ) {
        return {
          strategy: (strategy as { value: string }).value,
          apyBps: Number(asUint(apyBps as UIntCV)),
          tvlSats: asUint(tvl as UIntCV),
        };
      }
    }
  } catch {
    // Contract not deployed/reachable yet — fall back to the default rate.
  }

  return DEFAULT_RATE;
}

export interface Position {
  id: number;
  amountSats: bigint;
  accruedYieldSats: bigint;
  apyBps: number;
  strategy: string;
  /** True when accruedYieldSats was read from the live protocol instead of the router's fixed-APY estimate. */
  yieldIsLive: boolean;
}

// Strategies that actually route sBTC into an external live protocol (Zest's
// lending pool, Stacks' Dual Stacking rewards program). For these, the
// router's `get-position-value` reports accrued yield from a fixed-APY
// formula (elapsed blocks * apy-bps) — a stale estimate that was never wired
// up to real protocol state (see docs/milestone-2-plan.md section 4). The
// strategy contracts themselves already expose the real numbers: `get-tvl`
// is a read-only that returns the protocol-sourced total value (Zest's zsBTC
// balance, or the strategy's own sBTC balance for Dual Stacking — both
// interest/reward-inclusive), and `total-principal` is the pooled principal
// those values are measured against. `total-principal` has no getter
// function, but it's a plain data-var, so it's readable via the node's raw
// data-var endpoint. Hermetica and mock-yield pay a fixed synthetic rate with
// no external protocol behind them, so the router's formula is already the
// correct source for those — no override needed.
const LIVE_PROTOCOL_STRATEGIES: ReadonlySet<string> = new Set(['zest', 'dual-stacking']);

interface LiveStrategyTotals {
  totalValueSats: bigint;
  totalPrincipalSats: bigint;
}

async function fetchTotalPrincipalSats(address: string, name: string): Promise<bigint | null> {
  const res = await fetch(`${HIRO_API_URL}/v2/data_var/${address}/${name}/total-principal?proof=0`);
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: string };
  if (!body.data) return null;
  const cv = hexToCV(body.data);
  return cvType(cv) === CT.uint ? asUint(cv as UIntCV) : null;
}

async function fetchLiveStrategyTotals(name: StrategyName): Promise<LiveStrategyTotals | null> {
  const ref = STRATEGIES[name];
  if (!ref) return null;
  try {
    const [tvlResult, totalPrincipalSats] = await Promise.all([
      fetchCallReadOnlyFunction({
        contractAddress: ref.address,
        contractName: ref.name,
        functionName: 'get-tvl',
        functionArgs: [],
        senderAddress: ref.address,
        network,
      }),
      fetchTotalPrincipalSats(ref.address, ref.name),
    ]);
    if (totalPrincipalSats === null) return null;
    // get-tvl returns (response uint uint); unwrap the ok.
    const inner = cvType(tvlResult) === CT.ok ? (tvlResult as { value: unknown }).value : tvlResult;
    if (cvType(inner) !== CT.uint) return null;
    return { totalValueSats: asUint(inner as UIntCV), totalPrincipalSats };
  } catch {
    return null;
  }
}

/**
 * Reads every open position for `address`. Returns an empty list if the
 * contract isn't configured/deployed yet.
 */
export async function getPositions(address: string): Promise<Position[]> {
  if (!YIELD_ROUTER) return [];

  try {
    const idsResult = await fetchCallReadOnlyFunction({
      contractAddress: YIELD_ROUTER.address,
      contractName: YIELD_ROUTER.name,
      functionName: 'get-all-position-ids',
      functionArgs: [principalCV(address)],
      senderAddress: address,
      network,
    });

    if (cvType(idsResult) !== CT.list) return [];
    const ids = (idsResult as { value: unknown[] }).value
      .filter((v): v is UIntCV => cvType(v) === CT.uint)
      .map((v) => Number(asUint(v)));

    const positions = await Promise.all(ids.map((id) => getPosition(address, id)));
    const open = positions.filter((p): p is RawPosition => p !== null && !p.closed);

    // One live-totals read per distinct live-protocol strategy in play, not
    // per position, so a dashboard with several Zest positions still makes a
    // single get-tvl + total-principal read for Zest.
    const liveStrategyNames = [...new Set(open.map((p) => p.strategy))].filter(
      (s): s is StrategyName => LIVE_PROTOCOL_STRATEGIES.has(s)
    );
    const liveTotalsEntries = await Promise.all(
      liveStrategyNames.map(async (s) => [s, await fetchLiveStrategyTotals(s)] as const)
    );
    const liveTotals = new Map(liveTotalsEntries);

    return open.map((p) => {
      const totals = liveTotals.get(p.strategy as StrategyName);
      if (!totals || totals.totalPrincipalSats === 0n) return { ...p, yieldIsLive: false };
      const live =
        totals.totalValueSats > totals.totalPrincipalSats
          ? (p.amountSats * (totals.totalValueSats - totals.totalPrincipalSats)) / totals.totalPrincipalSats
          : 0n;
      return { ...p, accruedYieldSats: live, yieldIsLive: true };
    });
  } catch {
    return [];
  }
}

interface RawPosition extends Position {
  closed: boolean;
}

async function getPosition(address: string, id: number): Promise<RawPosition | null> {
  if (!YIELD_ROUTER) return null;

  const [positionResult, valueResult] = await Promise.all([
    fetchCallReadOnlyFunction({
      contractAddress: YIELD_ROUTER.address,
      contractName: YIELD_ROUTER.name,
      functionName: 'get-position',
      functionArgs: [principalCV(address), uintCV(id)],
      senderAddress: address,
      network,
    }),
    fetchCallReadOnlyFunction({
      contractAddress: YIELD_ROUTER.address,
      contractName: YIELD_ROUTER.name,
      functionName: 'get-position-value',
      functionArgs: [principalCV(address), uintCV(id)],
      senderAddress: address,
      network,
    }),
  ]);

  if (cvType(positionResult) !== CT.some || cvType(valueResult) !== CT.some) {
    return null;
  }

  const position = ((positionResult as { value: TupleCV }).value).value;
  const value = ((valueResult as { value: TupleCV }).value).value;

  const strategy = position.strategy;
  const apyBps = position['apy-bps'];
  const amount = value.amount;
  const accruedYield = value['accrued-yield'];
  const closed = value.closed;

  if (
    cvType(strategy) !== CT.ascii ||
    cvType(apyBps) !== CT.uint ||
    cvType(amount) !== CT.uint ||
    cvType(accruedYield) !== CT.uint ||
    (cvType(closed) !== CT.true && cvType(closed) !== CT.false)
  ) {
    return null;
  }

  return {
    id,
    amountSats: asUint(amount as UIntCV),
    accruedYieldSats: asUint(accruedYield as UIntCV),
    apyBps: Number(asUint(apyBps as UIntCV)),
    strategy: (strategy as { value: string }).value,
    yieldIsLive: false,
    closed: cvType(closed) === CT.true,
  };
}
