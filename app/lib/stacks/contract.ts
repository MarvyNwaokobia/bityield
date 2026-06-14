import { ClarityType, Cl, type TupleCV, type UIntCV } from '@stacks/transactions';
import { fetchCallReadOnlyFunction } from '@stacks/transactions';
import { network, YIELD_ROUTER } from './network';

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

    if (result.type === ClarityType.Tuple) {
      const value = (result as TupleCV).value;
      const strategy = value.strategy;
      const apyBps = value['apy-bps'];
      const tvl = value.tvl;
      if (
        strategy?.type === ClarityType.StringASCII &&
        apyBps?.type === ClarityType.UInt &&
        tvl?.type === ClarityType.UInt
      ) {
        return { strategy: strategy.value, apyBps: Number(asUint(apyBps)), tvlSats: asUint(tvl) };
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
      functionArgs: [Cl.principal(address)],
      senderAddress: address,
      network,
    });

    if (idsResult.type !== ClarityType.List) return [];
    const ids = idsResult.value
      .filter((v): v is UIntCV => v.type === ClarityType.UInt)
      .map((v) => Number(asUint(v)));

    const positions = await Promise.all(ids.map((id) => getPosition(address, id)));
    return positions.filter((p): p is RawPosition => p !== null && !p.closed);
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
      functionArgs: [Cl.principal(address), Cl.uint(id)],
      senderAddress: address,
      network,
    }),
    fetchCallReadOnlyFunction({
      contractAddress: YIELD_ROUTER.address,
      contractName: YIELD_ROUTER.name,
      functionName: 'get-position-value',
      functionArgs: [Cl.principal(address), Cl.uint(id)],
      senderAddress: address,
      network,
    }),
  ]);

  if (positionResult.type !== ClarityType.OptionalSome || valueResult.type !== ClarityType.OptionalSome) {
    return null;
  }

  const position = (positionResult.value as TupleCV).value;
  const value = (valueResult.value as TupleCV).value;

  const strategy = position.strategy;
  const apyBps = position['apy-bps'];
  const amount = value.amount;
  const accruedYield = value['accrued-yield'];
  const closed = value.closed;

  if (
    strategy?.type !== ClarityType.StringASCII ||
    apyBps?.type !== ClarityType.UInt ||
    amount?.type !== ClarityType.UInt ||
    accruedYield?.type !== ClarityType.UInt ||
    (closed?.type !== ClarityType.BoolTrue && closed?.type !== ClarityType.BoolFalse)
  ) {
    return null;
  }

  return {
    id,
    amountSats: asUint(amount),
    accruedYieldSats: asUint(accruedYield),
    apyBps: Number(asUint(apyBps)),
    strategy: strategy.value,
    closed: closed.type === ClarityType.BoolTrue,
  };
}
