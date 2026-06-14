'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/stacks/wallet';
import { getSbtcBalanceSats } from '@/lib/stacks/balances';
import { DEFAULT_APY_BPS, getBestRate, getPositions, type Position } from '@/lib/stacks/contract';
import { formatBtc } from '@/lib/stacks/format';
import { ConnectPrompt } from '../components/ConnectPrompt';

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
        <Link href="/" className="font-bold text-xl tracking-tight select-none">
          Bit<span className="text-[#F7931A]">Yield</span>
        </Link>
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
                <div className="w-10 h-10 border-4 border-zinc-700 border-t-[#F7931A] rounded-full animate-spin" />
              </div>
              <p className="text-zinc-400">Loading your dashboard…</p>
            </div>
          )}

          {isConnected && !loading && (
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                  Total Balance
                </p>
                <p className="text-4xl font-bold mb-6">{formatBtc(totalSats)} BTC</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-500 text-sm">Available</p>
                    <p className="text-lg font-mono">{formatBtc(balanceSats ?? 0n)} BTC</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm">Earning</p>
                    <p className="text-lg font-mono">{formatBtc(earningSats)} BTC</p>
                  </div>
                </div>

                {accruedYieldSats > 0n && (
                  <p className="text-[#F7931A] text-sm mt-6">
                    +{formatBtc(accruedYieldSats)} BTC earned so far at {apy}% APY, paid in
                    Bitcoin.
                  </p>
                )}

                <Link
                  href="/deposit"
                  className="block w-full text-center bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl mt-8 hover:bg-[#e8841a] transition-colors"
                >
                  Deposit
                </Link>
              </div>

              {positions && positions.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                  <p className="text-xl font-semibold mb-2">Nothing earning yet</p>
                  <p className="text-zinc-400 leading-relaxed">
                    Deposit Bitcoin to start earning {apy}% APY, paid in Bitcoin. Your Bitcoin
                    stays on Bitcoin L1 under your own keys.
                  </p>
                </div>
              )}

              {positions && positions.length > 0 && (
                <div className="space-y-4">
                  <p className="text-zinc-500 text-sm uppercase tracking-widest">
                    Open Positions
                  </p>
                  {positions.map((p) => (
                    <div
                      key={p.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-2xl font-bold">
                          {formatBtc(p.amountSats + p.accruedYieldSats)} BTC
                        </p>
                        <p className="text-zinc-500 text-sm mt-1">
                          {formatBtc(p.amountSats)} BTC principal + {formatBtc(p.accruedYieldSats)}{' '}
                          BTC earned · {p.apyBps / 100}% APY
                        </p>
                      </div>
                      <Link
                        href={`/withdraw?position=${p.id}`}
                        className="border border-zinc-700 text-zinc-300 font-semibold px-5 py-3 rounded-xl hover:border-zinc-500 transition-colors whitespace-nowrap"
                      >
                        Withdraw
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
