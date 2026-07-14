import { uintCV, principalCV, type TupleCV, type UIntCV } from '@stacks/transactions';
import { fetchCallReadOnlyFunction } from '@stacks/transactions';
import { network, YIELD_ROUTER } from './network';
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
    closed: cvType(closed) === CT.true,
  };
}
