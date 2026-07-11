'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ConnectWalletButton } from './components/ConnectWalletButton';
import { Logo } from './components/Logo';
import { RevealOnScroll, RevealItem } from './components/RevealOnScroll';
import { PrimaryLinkButton } from './components/Button';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';
import { fetchRouterStats, type RouterStats } from '@/lib/stacks/analytics';
import { satsToBtc } from '@/lib/stacks/format';

// ─── Content ─────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  { n: '01', title: 'Connect your wallet', desc: 'Link a Stacks wallet in seconds. No new accounts, no seed phrases to create.' },
  { n: '02', title: 'Choose your yield', desc: 'Pick a strategy and see the rate up front — always denominated in Bitcoin.' },
  { n: '03', title: 'Earn, withdraw anytime', desc: 'Non-custodial and open-ended. Your BTC works for you; pull it out whenever.' },
];

const INFRA = [
  { name: 'sBTC', role: '1:1 Bitcoin-backed asset', live: true },
  { name: 'Leather', role: 'Wallet & connection', live: true },
  { name: 'Hiro', role: 'Stacks API & tooling', live: true },
  { name: 'Zest Protocol', role: 'BTC lending yield', live: false },
  { name: 'Hermetica', role: 'Structured BTC yield', live: false },
  { name: 'Dual Stacking', role: 'PoX yield', live: false },
];

const FAQ = [
  {
    q: 'Does my Bitcoin leave the Bitcoin network?',
    a: 'No. sBTC is 1:1 Bitcoin-backed and secured by Bitcoin L1 consensus. You hold it under your own keys — there is no third-party custodian and no wrapped-token bridge risk.',
  },
  {
    q: 'Why don’t I pay gas in STX?',
    a: 'BitYield sponsors every transaction. When you sign a deposit or withdrawal, our sponsor account pays the STX network fee for you — so you never need to hold or spend STX.',
  },
  {
    q: 'How are the yield rates generated today?',
    a: 'Each strategy is currently a BitYield smart contract paying a fixed, transparent APY, labelled “Preview” in the app and fully verifiable on-chain. Live routing into the underlying protocols (Zest first) is our next milestone.',
  },
  {
    q: 'Can I withdraw at any time?',
    a: 'Yes. Positions are non-custodial and open-ended — trigger a withdrawal from your dashboard and your principal plus any accrued yield returns to your wallet.',
  },
];

// ─── Small pieces ────────────────────────────────────────────────────────────

function LivePill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Live on Bitcoin mainnet
    </span>
  );
}

function ProofMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="font-display text-3xl md:text-4xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-zinc-500 text-sm mt-1">{label}</p>
    </div>
  );
}

function LiveProof() {
  const [stats, setStats] = useState<RouterStats | null>(null);
  useEffect(() => {
    fetchRouterStats(50).then(setStats).catch(() => {});
  }, []);

  const volume = stats ? Number(satsToBtc(BigInt(stats.depositVolumeSats)).toFixed(8)).toString() : '—';
  const sponsoredPct =
    stats && stats.txs.length > 0 ? Math.round((stats.sponsoredCount / stats.txs.length) * 100) : 100;

  return (
    <RevealOnScroll className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 md:p-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-2">Live on-chain</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight max-w-md leading-snug">
            Every deposit is a real, public Bitcoin transaction.
          </h2>
        </div>
        <Link
          href="/proof"
          className="text-sm font-semibold text-bitcoin hover:underline whitespace-nowrap self-start md:self-auto"
        >
          Open the proof page →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-zinc-800 pt-8">
        <ProofMetric value={stats ? String(stats.totalDeposits) : '—'} label="Deposits" />
        <ProofMetric value={stats ? String(stats.totalWithdrawals) : '—'} label="Withdrawals" />
        <ProofMetric value={volume === '—' ? '—' : `${volume}`} label="BTC deposited" />
        <ProofMetric value={`${sponsoredPct}%`} label="Gas sponsored" />
      </div>
    </RevealOnScroll>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-md">
        <Logo />
        <div className="flex items-center gap-6">
          <Link href="/proof" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">
            Proof
          </Link>
          <Link href="/dashboard" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <ConnectWalletButton />
          <PrimaryLinkButton href="/deposit" className="px-5 py-2 text-sm">
            Launch App
          </PrimaryLinkButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-44 pb-28 md:pt-52 md:pb-36 text-center overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] max-w-full rounded-full bg-bitcoin/15 blur-3xl motion-safe:animate-float pointer-events-none"
        />
        <motion.div initial="initial" animate="animate" variants={staggerContainer} className="relative max-w-4xl mx-auto">
          <motion.div variants={fadeSlideUp} className="mb-8">
            <LivePill />
          </motion.div>
          <motion.h1
            variants={fadeSlideUp}
            className="font-display text-6xl md:text-8xl font-bold tracking-[-0.03em] leading-[0.95] mb-8"
          >
            Hold Bitcoin.
            <br />
            <span className="text-bitcoin">Earn Bitcoin.</span>
          </motion.h1>
          <motion.p
            variants={fadeSlideUp}
            className="text-lg md:text-xl text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Deposit sBTC and earn yield paid in Bitcoin — non-custodial, no bridges
            to manage, and zero gas fees to pay.
          </motion.p>
          <motion.div variants={fadeSlideUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryLinkButton href="/deposit" className="px-9 py-4 text-base w-full sm:w-auto">
              Launch App
            </PrimaryLinkButton>
            <Link
              href="/proof"
              className="text-base font-semibold text-zinc-300 hover:text-white transition-colors px-4 py-4"
            >
              See the on-chain proof →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Live proof */}
      <section className="px-6 pb-24 md:pb-32 max-w-5xl mx-auto">
        <LiveProof />
      </section>

      {/* Opportunity */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <RevealOnScroll className="max-w-3xl mx-auto text-center">
          <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-5">The opportunity</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            $1.3 trillion in Bitcoin earns 0%.
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
            The yield infrastructure is already live and audited on Stacks. BitYield is
            the simple front door — so your Bitcoin doesn’t have to sit idle.
          </p>
        </RevealOnScroll>
      </section>

      {/* How it works */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <RevealOnScroll className="mb-16 text-center">
            <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-3">Simple as it gets</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Three steps to yield.</h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            {HOW_STEPS.map(({ n, title, desc }) => (
              <RevealItem key={n} className="flex flex-col gap-3">
                <span className="font-display text-5xl font-bold text-bitcoin/25 leading-none tabular-nums">{n}</span>
                <p className="font-display text-xl font-semibold leading-snug mt-1">{title}</p>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </RevealItem>
            ))}
          </RevealOnScroll>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <RevealOnScroll className="mb-16 text-center">
            <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-3">Built on proven infrastructure</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight max-w-2xl mx-auto leading-snug">
              We don’t reinvent Bitcoin yield. We make it usable.
            </h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INFRA.map(({ name, role, live }) => (
              <RevealItem
                key={name}
                className="glow-card bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-display text-lg font-semibold">{name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{role}</p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap ${
                    live
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}
                >
                  {live ? 'Live' : 'Soon'}
                </span>
              </RevealItem>
            ))}
          </RevealOnScroll>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <RevealOnScroll className="mb-14 text-center">
            <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Good questions.</h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <RevealItem key={q} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-display font-semibold text-lg text-white mb-2">{q}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{a}</p>
              </RevealItem>
            ))}
          </RevealOnScroll>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-28 md:py-36 border-t border-zinc-900">
        <RevealOnScroll className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            Put your Bitcoin to work.
          </h2>
          <p className="text-lg text-zinc-400 mb-10 leading-relaxed max-w-lg mx-auto">
            Live on Bitcoin mainnet. Connect, deposit sBTC, and start earning — with zero gas to pay.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryLinkButton href="/deposit" className="px-9 py-4 text-base w-full sm:w-auto">
              Launch App
            </PrimaryLinkButton>
            <Link href="/proof" className="text-base font-semibold text-zinc-300 hover:text-white transition-colors px-4 py-4">
              Verify on-chain →
            </Link>
          </div>
          <p className="text-sm text-zinc-600 mt-8">Non-custodial · Withdraw anytime · No STX required</p>
        </RevealOnScroll>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <Logo />
          <div className="flex items-center gap-6 text-zinc-500">
            <Link href="/deposit" className="hover:text-white transition-colors">App</Link>
            <Link href="/proof" className="hover:text-white transition-colors">Proof</Link>
            <span>Built on Stacks · Secured by Bitcoin</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
