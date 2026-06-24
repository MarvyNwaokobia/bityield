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
import { ConnectPrompt } from '../components/ConnectPrompt';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PrimaryLinkButton, SecondaryLinkButton } from '../components/Button';

export default function DashboardPage() {
  const { address, isConnected } = useWallet();

  const [balanceSats, setBalanceSats] = useState<bigint | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [apyBps, setApyBps] = useState<number>(DEFAULT_APY_BPS);

  const refresh = useCallback(async () => {
    if (!address) return;
    const [balance, openPositions] = await Promise.all([
      getSbtcBalanceSats(address),
      getPositions(address),
    ]);
    setBalanceSats(balance);
    setPositions(openPositions);
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
  const loading = balanceSats === null || positions === null;

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
                    <p className="text-lg font-mono">
                      <AnimatedNumber value={satsToBtc(balanceSats ?? 0n)} formatter={(n) => n.toFixed(8)} />{' '}
                      BTC
                    </p>
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
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
