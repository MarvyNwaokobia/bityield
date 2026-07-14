'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '../components/Logo';
import { motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { getSbtcBalanceSats } from '@/lib/stacks/balances';
import { DEFAULT_APY_BPS, getBestRate, getPositions, type Position } from '@/lib/stacks/contract';
import { formatBtc, satsToBtc } from '@/lib/stacks/format';
import { fadeSlideUp, hoverScale, springTransition, staggerContainer } from '@/lib/motion';
import { fetchUserActivity, type RouterTx } from '@/lib/stacks/analytics';
import { NETWORK_NAME } from '@/lib/stacks/network';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PrimaryLinkButton, SecondaryLinkButton } from '../components/Button';

const explorerTxUrl = (txid: string) =>
  `https://explorer.hiro.so/txid/${txid}?chain=${NETWORK_NAME === 'mainnet' ? 'mainnet' : 'testnet'}`;

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function strategyLabel(name: string): string {
  if (name === 'zest') return 'Zest Lending';
  if (name === 'hermetica') return 'Hermetica Structured';
  if (name === 'dual-stacking') return 'Dual Stacking';
  return 'Mock Yield';
}

export default function DashboardPage() {
  const { address, isConnected } = useWallet();

  const [balanceSats, setBalanceSats] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [apyBps, setApyBps] = useState<number>(DEFAULT_APY_BPS);
  const [activity, setActivity] = useState<RouterTx[] | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setBalanceError(false);
    // Positions and history must render even if the balance read fails, so read
    // the balance independently and treat a failure as an error (not zero).
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
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    getBestRate().then((rate) => setApyBps(rate.apyBps));
  }, []);

  const apy = apyBps / 100;
  const earningSats = (positions ?? []).reduce(
    (sum, p) => sum + p.amountSats + p.accruedYieldSats,
    0n
  );
  const accruedYieldSats = (positions ?? []).reduce((sum, p) => sum + p.accruedYieldSats, 0n);
  const totalSats = (balanceSats ?? 0n) + earningSats;
  const loading = (balanceSats === null && !balanceError) || positions === null;

  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50">
        <Logo />
        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Back
        </Link>
      </nav>

      <main className="flex-1 px-6 py-16">
        <div className="w-full max-w-2xl mx-auto">
          {!isConnected && (
            <ConnectPrompt description="Connect your Stacks wallet to view your balance and positions." />
          )}

          {isConnected && loading && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-10 h-10 border-4 border-zinc-700 border-t-bitcoin rounded-full animate-spin" />
              </div>
              <p className="text-zinc-400">Loading your dashboard…</p>
            </div>
          )}

          {isConnected && !loading && (
            <motion.div
              initial="initial"
              animate="animate"
              variants={staggerContainer}
              className="space-y-6"
            >
              <motion.div
                variants={fadeSlideUp}
                className="glow-card bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
              >
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                  Total Balance
                </p>
                <p className="font-display text-4xl font-bold mb-6">
                  <AnimatedNumber value={satsToBtc(totalSats)} formatter={(n) => n.toFixed(8)} /> BTC
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-500 text-sm">Available</p>
                    {balanceError ? (
                      <button
                        onClick={refresh}
                        className="text-lg font-mono text-amber-400 hover:underline cursor-pointer"
                        title="We couldn't load your balance — your sBTC is safe. Tap to retry."
                      >
                        — · Retry
                      </button>
                    ) : (
                      <p className="text-lg font-mono">
                        <AnimatedNumber value={satsToBtc(balanceSats ?? 0n)} formatter={(n) => n.toFixed(8)} />{' '}
                        BTC
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm">Earning</p>
                    <p className="text-lg font-mono">
                      <AnimatedNumber value={satsToBtc(earningSats)} formatter={(n) => n.toFixed(8)} /> BTC
                    </p>
                  </div>
                </div>

                {accruedYieldSats > 0n && (
                  <p className="text-bitcoin text-sm mt-6 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-bitcoin motion-safe:animate-ping opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-bitcoin" />
                    </span>
                    +{formatBtc(accruedYieldSats)} BTC earned so far at {apy}% APY, paid in Bitcoin.
                  </p>
                )}

                <PrimaryLinkButton href="/deposit" className="w-full px-6 py-4 mt-8">
                  Deposit
                </PrimaryLinkButton>
              </motion.div>

              {positions && positions.length === 0 && (
                <motion.div
                  variants={fadeSlideUp}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
                >
                  <div className="flex justify-center mb-6">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <span className="absolute inset-0 rounded-full bg-bitcoin/10 motion-safe:animate-ping" />
                      <span className="relative w-3 h-3 rounded-full bg-bitcoin" />
                    </div>
                  </div>
                  <p className="text-xl font-semibold mb-2">Nothing earning yet</p>
                  <p className="text-zinc-400 leading-relaxed">
                    Deposit Bitcoin to start earning {apy}% APY, paid in Bitcoin. Your Bitcoin
                    stays on Bitcoin L1 under your own keys.
                  </p>
                </motion.div>
              )}

              {positions && positions.length > 0 && (
                <motion.div variants={staggerContainer} className="space-y-4">
                  <motion.p variants={fadeSlideUp} className="text-zinc-500 text-sm uppercase tracking-widest">
                    Open Positions
                  </motion.p>
                  {positions.map((p) => {
                    const getStrategyDisplayName = (strategyName: string) => {
                      if (strategyName === 'zest') return 'Zest Lending';
                      if (strategyName === 'hermetica') return 'Hermetica Structured';
                      if (strategyName === 'dual-stacking') return 'Dual Stacking';
                      return 'Mock Yield';
                    };
                    return (
                      <motion.div
                        key={p.id}
                        variants={fadeSlideUp}
                        whileHover={{ ...hoverScale, y: -4 }}
                        transition={springTransition}
                        className="glow-card bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] px-2.5 py-0.5 rounded-full font-bold bg-bitcoin/10 text-bitcoin border border-bitcoin/20 uppercase tracking-wider">
                              {getStrategyDisplayName(p.strategy)}
                            </span>
                          </div>
                          <p className="font-display text-2xl font-bold">
                            <AnimatedNumber
                              value={satsToBtc(p.amountSats + p.accruedYieldSats)}
                              formatter={(n) => n.toFixed(8)}
                            />{' '}
                            BTC
                          </p>
                          <p className="text-zinc-500 text-sm mt-1">
                            {formatBtc(p.amountSats)} BTC principal + {formatBtc(p.accruedYieldSats)}{' '}
                            BTC earned · {p.apyBps / 100}% APY
                          </p>
                        </div>
                        <SecondaryLinkButton
                          href={`/withdraw?position=${p.id}`}
                          className="px-5 py-3 whitespace-nowrap"
                        >
                          Withdraw
                        </SecondaryLinkButton>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {activity && activity.length > 0 && (
                <motion.div variants={staggerContainer} className="space-y-4">
                  <motion.p variants={fadeSlideUp} className="text-zinc-500 text-sm uppercase tracking-widest">
                    Transaction history
                  </motion.p>
                  <motion.div
                    variants={fadeSlideUp}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800/70 overflow-hidden"
                  >
                    {activity.map((t) => {
                      const isDeposit = t.functionName === 'deposit';
                      return (
                        <div key={t.txid} className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                                isDeposit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-bitcoin/10 text-bitcoin'
                              }`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d={isDeposit ? 'M12 4.5v15m0 0 6-6m-6 6-6-6' : 'M12 19.5v-15m0 0-6 6m6-6 6 6'}
                                />
                              </svg>
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium capitalize truncate">
                                {t.functionName}
                                {t.strategy ? <span className="text-zinc-500 font-normal"> · {strategyLabel(t.strategy)}</span> : ''}
                              </p>
                              <p className="text-zinc-500 text-xs">
                                {formatWhen(t.timeIso)} · {t.sponsored ? 'Gas sponsored' : 'Self-paid'}
                                {t.status !== 'success' && <span className="text-red-400"> · {t.status}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm tabular-nums">
                              {t.amountSats != null ? `${satsToBtc(BigInt(t.amountSats)).toFixed(8)} BTC` : '—'}
                            </p>
                            <a
                              href={explorerTxUrl(t.txid)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-bitcoin/90 hover:text-bitcoin text-xs hover:underline"
                            >
                              View on explorer ↗
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
