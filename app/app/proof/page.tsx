'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '../components/Logo';
import { fetchRouterStats, txsToCsv, type RouterStats } from '@/lib/stacks/analytics';
import { satsToBtc } from '@/lib/stacks/format';
import {
  NETWORK_NAME,
  YIELD_ROUTER,
  SBTC_TOKEN,
  STRATEGIES,
  toContractId,
  explorerContractUrl,
  type StrategyName,
} from '@/lib/stacks/network';

const chain = NETWORK_NAME === 'mainnet' ? 'mainnet' : 'testnet';
const explorerTxUrl = (txid: string) => `https://explorer.hiro.so/txid/${txid}?chain=${chain}`;

function shortId(id: string) {
  if (id.includes('.')) {
    const [addr, name] = id.split('.');
    return `${addr.slice(0, 6)}…${addr.slice(-4)}.${name}`;
  }
  return `${id.slice(0, 10)}…${id.slice(-6)}`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5">
      <p className="text-zinc-500 text-xs uppercase tracking-widest">{label}</p>
      <p className="font-display text-3xl font-bold mt-2">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function ProofPage() {
  const [stats, setStats] = useState<RouterStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchRouterStats().then(setStats).catch(() => setError(true));
  }, []);

  const downloadCsv = () => {
    if (!stats) return;
    const blob = new Blob([txsToCsv(stats.txs)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bityield-onchain-activity-${chain}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const contracts: { label: string; id: string | null }[] = [
    { label: 'YieldRouter', id: YIELD_ROUTER ? toContractId(YIELD_ROUTER) : null },
    { label: 'sBTC token', id: SBTC_TOKEN ? toContractId(SBTC_TOKEN) : null },
    ...(Object.keys(STRATEGIES) as StrategyName[]).map((name) => ({
      label: `${name} strategy`,
      id: STRATEGIES[name] ? toContractId(STRATEGIES[name]!) : null,
    })),
  ];

  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50">
        <Logo />
        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Home
        </Link>
      </nav>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-14">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-3xl md:text-4xl font-bold">On-chain proof</h1>
          <span className="text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {chain}
          </span>
        </div>
        <p className="text-zinc-400 leading-relaxed mb-10 max-w-2xl">
          Every BitYield deposit and withdrawal is a real transaction settled on Stacks and secured
          by Bitcoin. This page reads live activity straight from the canonical chain — anyone can
          verify it, and each row links to the public explorer.
        </p>

        {error && (
          <p className="text-zinc-500">Couldn&apos;t load on-chain activity. Try again shortly.</p>
        )}

        {!error && !stats && (
          <div className="flex items-center gap-3 text-zinc-500">
            <span className="w-5 h-5 border-2 border-zinc-700 border-t-bitcoin rounded-full animate-spin" />
            Loading on-chain activity…
          </div>
        )}

        {stats && (
          <>
            {/* Headline stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <StatTile label="Deposits" value={String(stats.totalDeposits)} />
              <StatTile label="Withdrawals" value={String(stats.totalWithdrawals)} />
              <StatTile
                label="Deposit volume"
                value={`${satsToBtc(BigInt(stats.depositVolumeSats)).toFixed(8)}`}
                sub="BTC"
              />
              <StatTile label="Unique wallets" value={String(stats.uniqueUsers)} />
            </div>

            {/* Contracts */}
            <h2 className="font-display text-xl font-bold mb-4">Contracts (verify yourself)</h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 mb-12">
              {contracts.map(({ label, id }) => (
                <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="text-zinc-400 text-sm">{label}</span>
                  {id ? (
                    <a
                      href={explorerContractUrl(id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-bitcoin/90 hover:text-bitcoin hover:underline break-all text-right"
                    >
                      {shortId(id)} ↗
                    </a>
                  ) : (
                    <span className="text-zinc-600 text-xs">not configured</span>
                  )}
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Transaction history</h2>
              <button
                onClick={downloadCsv}
                className="text-xs font-semibold border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
              >
                ↓ Export CSV
              </button>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left font-medium px-4 py-3">Action</th>
                    <th className="text-left font-medium px-4 py-3">Amount</th>
                    <th className="text-left font-medium px-4 py-3">Wallet</th>
                    <th className="text-left font-medium px-4 py-3">Gas</th>
                    <th className="text-left font-medium px-4 py-3">Status</th>
                    <th className="text-right font-medium px-4 py-3">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {stats.txs.map((t) => (
                    <tr key={t.txid} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-medium capitalize whitespace-nowrap">
                        {t.functionName}
                        {t.strategy && <span className="text-zinc-500 font-normal"> · {t.strategy}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300 whitespace-nowrap">
                        {t.amountSats != null ? `${satsToBtc(BigInt(t.amountSats)).toFixed(8)} BTC` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400 whitespace-nowrap">
                        {t.sender.slice(0, 6)}…{t.sender.slice(-4)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.sponsored ? (
                          <span className="text-emerald-400 text-xs">Sponsored</span>
                        ) : (
                          <span className="text-zinc-500 text-xs">Self</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={t.status === 'success' ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <a
                          href={explorerTxUrl(t.txid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-bitcoin/90 hover:text-bitcoin hover:underline text-xs"
                        >
                          View ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                  {stats.txs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-zinc-600 text-xs mt-4">
              Reads the router&apos;s latest {stats.txs.length} contract calls from the Hiro API.
              {stats.sponsoredCount > 0 &&
                ` ${stats.sponsoredCount} were gas-sponsored (users paid 0 STX).`}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
