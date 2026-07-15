'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ConnectWalletButton } from './components/ConnectWalletButton';
import { Logo } from './components/Logo';
import { RevealOnScroll, RevealItem } from './components/RevealOnScroll';
import { PrimaryLinkButton } from './components/Button';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';
import { fetchRouterStats, type RouterStats } from '@/lib/stacks/analytics';
import { satsToBtc } from '@/lib/stacks/format';

// ─── Icons (SVG, no emoji) ────────────────────────────────────────────────────

const Icon = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.03 5.912l-4.717 4.717a2.25 2.25 0 0 1-1.591.659H8.25v1.5H6.75v1.5H4.5a1.125 1.125 0 0 1-1.125-1.125v-2.25c0-.398.158-.78.44-1.06l6.827-6.828A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.96 11.96 0 0 1 3.6 6 12 12 0 0 0 3 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.25-8.25-3.29Z" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.31 4.31a12 12 0 0 1 5.81-5.52l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.94" />
    </svg>
  ),
};

// ─── Content ─────────────────────────────────────────────────────────────────

const HERO_BULLETS = ['Non-custodial — your keys', 'No bridges to manage', 'Zero gas fees to pay'];

const FEATURES = [
  { icon: Icon.key, title: 'Your keys, your Bitcoin', desc: 'Non-custodial by design. Your BTC stays under your control — BitYield never holds it.' },
  { icon: Icon.shield, title: 'No bridges, no wrapping', desc: 'sBTC is 1:1 Bitcoin-backed and secured by Bitcoin L1. No synthetic assets, no bridge risk.' },
  { icon: Icon.bolt, title: 'Zero gas fees', desc: 'Every transaction is sponsored. You never need to hold or spend STX to deposit or withdraw.' },
  { icon: Icon.chart, title: 'Yield paid in Bitcoin', desc: 'Earnings are denominated and paid in BTC — never points, tokens, or derivatives.' },
];

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
  { q: 'Does my Bitcoin leave the Bitcoin network?', a: 'No. sBTC is 1:1 Bitcoin-backed and secured by Bitcoin L1 consensus. You hold it under your own keys — no third-party custodian and no wrapped-token bridge risk.' },
  { q: 'Why don’t I pay gas in STX?', a: 'BitYield sponsors every transaction. When you sign a deposit or withdrawal, our sponsor account pays the STX network fee for you — so you never need to hold STX.' },
  { q: 'How are the yield rates generated today?', a: 'Each strategy is a BitYield smart contract paying a fixed, transparent APY today — clearly labelled “Preview” and fully verifiable on-chain. Next, we route deposits into live protocols (starting with Zest) so your yield comes straight from the market.' },
  { q: 'Can I withdraw at any time?', a: 'Yes, always. Positions are non-custodial and open-ended — trigger a withdrawal from your dashboard and your principal plus any accrued yield returns to your wallet. No lock-ups, no waiting periods.' },
  { q: 'What is sBTC, and how do I get it?', a: 'sBTC is Bitcoin on Stacks — 1:1 Bitcoin-backed, so 1 sBTC always equals 1 BTC. You get it by sending BTC through the official sBTC bridge (sbtc.stacks.co), and BitYield links you straight there from the deposit screen.' },
  { q: 'Which wallets are supported?', a: 'Any Stacks wallet works — we recommend Leather, and Xverse is supported too. Connect in one tap; there is no separate BitYield account to create.' },
  { q: 'Is BitYield safe to use?', a: 'BitYield is non-custodial by design: your funds live in open, on-chain smart contracts that only you can withdraw from — never on our servers. Every contract is public and verifiable on the explorer (see the Proof page), and we have deliberately kept them simple and transparent. A third-party security audit is on our roadmap as we scale.' },
  { q: 'Are there lock-ups, minimums, or hidden fees?', a: 'None. Deposit and withdraw whenever you like, in any amount. Gas is fully sponsored, so you pay no network fees — and there are no deposit or withdrawal charges.' },
  { q: 'What happens to my funds if BitYield goes away?', a: 'They stay yours. Your position lives in an on-chain smart contract keyed to your address — not on our servers — so even if the BitYield app disappeared, only you can withdraw your funds by calling the contract directly.' },
];

// ─── Pieces ──────────────────────────────────────────────────────────────────

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

// Product mockup shown in the hero — mirrors the real dashboard.
function AppPreview() {
  return (
    <div className="relative motion-safe:animate-floaty">
      <div aria-hidden className="absolute -inset-6 rounded-4xl bg-bitcoin/20 blur-3xl" />
      <div className="glass card-sheen relative rounded-3xl p-6 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between mb-6">
          <span className="text-zinc-400 text-xs uppercase tracking-widest">Portfolio</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Earning
          </span>
        </div>
        <p className="text-zinc-500 text-xs mb-1">Total balance</p>
        <p className="font-display text-4xl font-bold tracking-tight tabular-nums">0.50000000</p>
        <p className="text-bitcoin text-sm mt-1 tabular-nums">+0.00000112 BTC · 4.5% APY</p>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-bitcoin/10 text-bitcoin border border-bitcoin/20">
                Zest Lending
              </span>
              <p className="font-display text-lg font-bold mt-2 tabular-nums">0.30000000 BTC</p>
              <p className="text-zinc-500 text-xs">principal + yield</p>
            </div>
            <span className="text-bitcoin font-display font-bold text-sm">4.5% APY</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-bitcoin text-black text-center text-sm font-semibold py-3">
          Deposit
        </div>
      </div>
    </div>
  );
}

function ProofMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
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
  const sponsoredPct = stats && stats.txs.length > 0 ? Math.round((stats.sponsoredCount / stats.txs.length) * 100) : 100;

  return (
    <RevealOnScroll className="glass card-sheen rounded-3xl p-8 md:p-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-2">Live on-chain</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight max-w-md leading-snug">
            Every deposit is a real, public Bitcoin transaction.
          </h2>
        </div>
        <Link href="/proof" className="text-sm font-semibold text-bitcoin hover:underline whitespace-nowrap self-start md:self-auto">
          Open the proof page →
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-white/10 pt-8">
        <ProofMetric value={stats ? String(stats.totalDeposits) : '—'} label="Deposits" />
        <ProofMetric value={stats ? String(stats.totalWithdrawals) : '—'} label="Withdrawals" />
        <ProofMetric value={volume} label="BTC deposited" />
        <ProofMetric value={`${sponsoredPct}%`} label="Gas sponsored" />
      </div>
    </RevealOnScroll>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-bitcoin font-mono text-xs uppercase tracking-widest mb-3">{children}</p>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden transition-colors hover:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 cursor-pointer"
      >
        <span className="font-display font-semibold text-base md:text-lg text-white">{q}</span>
        <span className={`shrink-0 text-bitcoin transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="text-zinc-400 text-sm leading-relaxed px-6 pb-5">{a}</p>
        </div>
      </div>
    </div>
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
          <Link href="/proof" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">Proof</Link>
          <Link href="/dashboard" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
          <ConnectWalletButton />
          <PrimaryLinkButton href="/dashboard" className="px-5 py-2 text-sm">Launch App</PrimaryLinkButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-24 md:pt-44 md:pb-32">
        <div aria-hidden className="absolute inset-0 mesh-bg pointer-events-none" />
        <div aria-hidden className="absolute inset-0 grid-lines pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          {/* Left */}
          <motion.div initial="initial" animate="animate" variants={staggerContainer} className="text-center lg:text-left">
            <motion.div variants={fadeSlideUp} className="mb-6 flex justify-center lg:justify-start">
              <LivePill />
            </motion.div>
            <motion.h1 variants={fadeSlideUp} className="font-display text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[0.98]">
              Hold Bitcoin.
              <br />
              <span className="text-bitcoin">Earn Bitcoin.</span>
            </motion.h1>
            <motion.p variants={fadeSlideUp} className="text-lg text-zinc-400 max-w-lg mx-auto lg:mx-0 mt-6 leading-relaxed">
              Deposit sBTC and earn yield paid in Bitcoin — non-custodial, no bridges to
              manage, and zero gas fees.
            </motion.p>
            <motion.ul variants={fadeSlideUp} className="mt-7 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-x-6 gap-y-2.5 max-w-lg mx-auto lg:mx-0">
              {HERO_BULLETS.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span className="text-emerald-400">{Icon.check}</span>
                  {b}
                </li>
              ))}
            </motion.ul>
            <motion.div variants={fadeSlideUp} className="mt-9 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <PrimaryLinkButton href="/dashboard" className="px-9 py-4 text-base w-full sm:w-auto">Launch App</PrimaryLinkButton>
              <Link href="/proof" className="text-base font-semibold text-zinc-300 hover:text-white transition-colors px-4 py-4">
                See the on-chain proof →
              </Link>
            </motion.div>
          </motion.div>

          {/* Right — product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            className="w-full max-w-sm mx-auto lg:mr-0 lg:ml-auto"
          >
            <AppPreview />
          </motion.div>
        </div>
      </section>

      {/* Live proof */}
      <section className="px-6 pb-24 md:pb-28 max-w-5xl mx-auto -mt-6">
        <LiveProof />
      </section>

      {/* Why / features */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll className="max-w-2xl mb-16">
            <SectionLabel>Why BitYield</SectionLabel>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]">
              Built to be trusted, not just used.
            </h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <RevealItem key={title} className="glow-card bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="text-bitcoin w-fit p-2.5 rounded-xl bg-bitcoin/10 mb-5">{icon}</div>
                <p className="font-display text-lg font-semibold">{title}</p>
                <p className="text-zinc-500 text-sm mt-2 leading-relaxed">{desc}</p>
              </RevealItem>
            ))}
          </RevealOnScroll>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll className="mb-16">
            <SectionLabel>Simple as it gets</SectionLabel>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Three steps to yield.</h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_STEPS.map(({ n, title, desc }) => (
              <RevealItem
                key={n}
                className="group glow-card relative rounded-2xl border border-zinc-800 bg-zinc-900/40 p-7 transition-transform duration-200 ease-out hover:-translate-y-1.5 cursor-default"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-5xl font-bold text-bitcoin/25 group-hover:text-bitcoin transition-colors duration-200 leading-none tabular-nums">
                    {n}
                  </span>
                  <span className="text-bitcoin opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </div>
                <p className="font-display text-xl font-semibold leading-snug mt-4">{title}</p>
                <p className="text-zinc-500 text-sm leading-relaxed mt-2">{desc}</p>
              </RevealItem>
            ))}
          </RevealOnScroll>
        </div>
      </section>

      {/* Opportunity band */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 mesh-bg opacity-60 pointer-events-none" />
        <RevealOnScroll className="relative max-w-3xl mx-auto text-center">
          <SectionLabel>The opportunity</SectionLabel>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            $1.3 trillion in Bitcoin earns 0%.
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
            The yield infrastructure is already live and audited on Stacks. BitYield is the
            simple front door — so your Bitcoin doesn’t have to sit idle.
          </p>
        </RevealOnScroll>
      </section>

      {/* Infrastructure */}
      <section className="px-6 py-24 md:py-32 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll className="max-w-2xl mb-16">
            <SectionLabel>Built on proven infrastructure</SectionLabel>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-snug">
              We don’t reinvent Bitcoin yield. We make it usable.
            </h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INFRA.map(({ name, role, live }) => (
              <RevealItem key={name} className="glow-card bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold">{name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{role}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap ${live ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
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
          <RevealOnScroll className="mb-14">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Good questions.</h2>
          </RevealOnScroll>
          <RevealOnScroll stagger className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <RevealItem key={q}>
                <FaqItem q={q} a={a} />
              </RevealItem>
            ))}
          </RevealOnScroll>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 md:py-28">
        <RevealOnScroll className="relative max-w-5xl mx-auto overflow-hidden rounded-3xl border border-bitcoin/20 px-8 py-16 md:py-20 text-center">
          <div aria-hidden className="absolute inset-0 mesh-bg pointer-events-none" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
              Put your Bitcoin to work.
            </h2>
            <p className="text-lg text-zinc-300 mb-10 leading-relaxed max-w-lg mx-auto">
              Live on Bitcoin mainnet. Connect, deposit sBTC, and start earning — with zero gas to pay.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <PrimaryLinkButton href="/dashboard" className="px-9 py-4 text-base w-full sm:w-auto">Launch App</PrimaryLinkButton>
              <Link href="/proof" className="text-base font-semibold text-white/90 hover:text-white transition-colors px-4 py-4">
                Verify on-chain →
              </Link>
            </div>
            <p className="text-sm text-zinc-500 mt-8">Non-custodial · Withdraw anytime · No STX required</p>
          </div>
        </RevealOnScroll>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <Logo />
          <div className="flex items-center gap-6 text-zinc-500">
            <Link href="/dashboard" className="hover:text-white transition-colors">App</Link>
            <Link href="/proof" className="hover:text-white transition-colors">Proof</Link>
            <span>Built on Stacks · Secured by Bitcoin</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
