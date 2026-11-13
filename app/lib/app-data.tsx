'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '@/lib/stacks/wallet';
import { getSbtcBalanceSats } from '@/lib/stacks/balances';
import {
  DEFAULT_APY_BPS,
  getBestLiveApyPercent,
  getLiveApyPercent,
  getPositions,
  type Position,
} from '@/lib/stacks/contract';
import { fetchUserActivity, type RouterTx } from '@/lib/stacks/analytics';
import type { StrategyName } from '@/lib/stacks/network';

interface AppData {
  balanceSats: bigint | null;
  balanceError: boolean;
  balanceRetrying: boolean;
  positions: Position[] | null;
  activity: RouterTx[] | null;
  bestApy: number;
  liveApy: Partial<Record<StrategyName, number>>;
  earningSats: bigint;
  accruedYieldSats: bigint;
  totalSats: bigint;
  loading: boolean;
  retryBalance: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

/**
 * Loads balance, positions, activity and live rates once for the whole signed-in
 * app, so switching tabs never re-fires the Hiro read burst.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [balanceRaw, setBalanceSats] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [balanceRetrying, setBalanceRetrying] = useState(false);
  const [positionsRaw, setPositions] = useState<Position[] | null>(null);
  const [activityRaw, setActivity] = useState<RouterTx[] | null>(null);
  const [bestApy, setBestApy] = useState(DEFAULT_APY_BPS / 100);
  const [liveApy, setLiveApy] = useState<Partial<Record<StrategyName, number>>>({});

  // Retries only the balance read. A full refresh fans out into a dozen-plus
  // parallel Hiro calls, and repeated clicks compounded the rate limiting.
  const retryBalance = useCallback(async () => {
    if (!address || balanceRetrying) return;
    setBalanceRetrying(true);
    setBalanceError(false);
    try {
      setBalanceSats(await getSbtcBalanceSats(address));
    } catch {
      setBalanceSats(null);
      setBalanceError(true);
    } finally {
      setBalanceRetrying(false);
    }
  }, [address, balanceRetrying]);

  const refresh = useCallback(async () => {
    if (!address) return;
    setBalanceError(false);
    // Positions and history must render even if the balance read fails.
    const [openPositions, userTxs] = await Promise.all([
      getPositions(address),
      fetchUserActivity(address).catch(() => [] as RouterTx[]),
    ]);
    setPositions(openPositions);
    setActivity(userTxs);
    try {
      setBalanceSats(await getSbtcBalanceSats(address));
    } catch {
      setBalanceSats(null);
      setBalanceError(true);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    (async () => {
      await refresh();
    })();
  }, [address, refresh]);

  useEffect(() => {
    getBestLiveApyPercent().then(setBestApy);
    Promise.all([getLiveApyPercent('zest'), getLiveApyPercent('dual-stacking')]).then(([zest, dual]) => {
      const next: Partial<Record<StrategyName, number>> = {};
      if (zest !== null) next.zest = zest;
      if (dual !== null) next['dual-stacking'] = dual;
      setLiveApy(next);
    });
  }, []);

  const value = useMemo<AppData>(() => {
    // Signed out (or switched away): never show a previous wallet's data.
    const positions = address ? positionsRaw : null;
    const activity = address ? activityRaw : null;
    const balanceSats = address ? balanceRaw : null;
    const earningSats = (positions ?? []).reduce((s, p) => s + p.amountSats + p.accruedYieldSats, 0n);
    const accruedYieldSats = (positions ?? []).reduce((s, p) => s + p.accruedYieldSats, 0n);
    return {
      balanceSats,
      balanceError,
      balanceRetrying,
      positions,
      activity,
      bestApy,
      liveApy,
      earningSats,
      accruedYieldSats,
      totalSats: (balanceSats ?? 0n) + earningSats,
      loading: !!address && ((balanceSats === null && !balanceError) || positions === null),
      retryBalance,
      refresh,
    };
  }, [address, balanceRaw, balanceError, balanceRetrying, positionsRaw, activityRaw, bestApy, liveApy, retryBalance, refresh]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
