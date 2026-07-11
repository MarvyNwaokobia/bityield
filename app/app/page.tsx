'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ConnectWalletButton } from './components/ConnectWalletButton';
import { Logo } from './components/Logo';
import { AnimatedNumber } from './components/AnimatedNumber';
import { RevealOnScroll, RevealItem } from './components/RevealOnScroll';
import { PrimaryLinkButton } from './components/Button';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';

// ─── Data ────────────────────────────────────────────────────────────────────

const OPPORTUNITY_STATS: { value: number; format: (n: number) => string; label: string }[] = [
  { value: 1.3, format: (n) => `$${n.toFixed(1)}T`, label: 'in Bitcoin sitting completely idle right now' },
  { value: 73, format: (n) => `${Math.round(n)}%`, label: 'of Bitcoin holders want yield on their BTC' },
  { value: 77, format: (n) => `${Math.round(n)}%`, label: 'have never tried — the tools felt built for traders' },
];

const HOW_STEPS = [
  { n: '01', title: 'Connect your Bitcoin wallet', desc: 'Link your Stacks wallet in seconds — no new accounts.' },
  { n: '02', title: 'See your balance and yield rate', desc: 'Live APY, transparent rates, always paid in Bitcoin.' },
  { n: '03', title: 'One button. Your Bitcoin goes to work.', desc: 'Non-custodial. Withdraw anytime, no lock-up periods.' },
];

const PROOF_STATS: { value: number; format: (n: number) => string; label: string }[] = [
  { value: 545, format: (n) => `$${Math.round(n)}M`, label: 'Bitcoin already deployed on Stacks' },
  { value: 100, format: (n) => `$${Math.round(n)}M+`, label: 'Capital earning yield through Dual Stacking' },
  { value: 70, format: (n) => `$${Math.round(n)}M+`, label: 'Deposits on Zest Protocol' },
  { value: 5, format: (n) => `${Math.round(n)}% APY`, label: 'Paid in Bitcoin, not tokens' },
];

const TRUST_POINTS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    title: 'Your keys, your Bitcoin',
    desc: 'Non-custodial. Your BTC stays on-chain under your control at all times — we never hold it.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    title: 'No bridges or wrapping',
    desc: 'Your Bitcoin stays on Bitcoin L1. No synthetic assets, no bridge risk, no wrapped tokens.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
      </svg>
    ),
    title: 'Yield paid in Bitcoin',
    desc: 'Every bit of yield you earn is denominated and paid in BTC — not points, tokens, or derivatives.',
  },
];

// ─── Shared StatCard ──────────────────────────────────────────────────────────

function StatCard({ value, format, label }: { value: number; format: (n: number) => string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <motion.div
      ref={ref}
      variants={fadeSlideUp}
      className="glow-card bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 text-center"
    >
      <p className="font-display text-3xl md:text-4xl font-bold text-bitcoin leading-tight">
        <AnimatedNumber value={inView ? value : 0} formatter={format} />
      </p>
      <p className="text-zinc-500 text-sm mt-3 leading-snug">{label}</p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-800/50 bg-[#0a0a0a]/90 backdrop-blur-sm">
        <Logo />
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <ConnectWalletButton />
          <PrimaryLinkButton href="/deposit" className="px-5 py-2 text-sm">
            Launch App
          </PrimaryLinkButton>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6 text-center max-w-4xl mx-auto overflow-hidden">
        <div
          aria-hidden
          className="absolute top-10 left-1/2 -translate-x-1/2 w-xl h-144 rounded-full bg-bitcoin/20 blur-3xl animate-float pointer-events-none"
        />
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="relative"
        >
          <motion.h1
            variants={fadeSlideUp}
            className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6"
          >
            Hold Bitcoin.{' '}
            <span className="text-bitcoin">Earn Bitcoin.</span>
          </motion.h1>
          <motion.p
            variants={fadeSlideUp}
            className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Your idle Bitcoin earns up to 8.5% APY — paid directly in BTC.
            No bridges, no tokens, no complexity.
          </motion.p>
          <motion.div variants={fadeSlideUp}>
            <PrimaryLinkButton href="/deposit" className="px-10 py-5 text-lg mb-5">
              Launch App
            </PrimaryLinkButton>
          </motion.div>
          <motion.p variants={fadeSlideUp} className="text-sm text-zinc-500">
            Live yield infrastructure. Real Bitcoin returns. No DeFi knowledge required.
          </motion.p>
        </motion.div>
      </section>

      {/* ── Opportunity ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <RevealOnScroll className="text-center mb-14">
          <p className="text-bitcoin font-mono text-sm uppercase tracking-widest mb-3">The opportunity</p>
          <p className="text-zinc-500 text-base max-w-xl mx-auto leading-relaxed">
            Billions in idle Bitcoin. Clear demand. A front door that has never existed — until now.
          </p>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {OPPORTUNITY_STATS.map(({ value, format, label }) => (
            <StatCard key={label} value={value} format={format} label={label} />
          ))}
        </RevealOnScroll>
        <RevealOnScroll className="text-center mt-10">
          <p className="text-zinc-600 text-sm max-w-xl mx-auto">
            The infrastructure already exists. BitYield is the simple front door.
          </p>
        </RevealOnScroll>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <RevealOnScroll className="text-center mb-14">
          <p className="text-bitcoin font-mono text-sm uppercase tracking-widest">Simple as it gets.</p>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {HOW_STEPS.map(({ n, title, desc }) => (
            <RevealItem key={n} className="flex flex-col gap-3">
              <span className="font-display text-6xl font-bold text-bitcoin/30 leading-none">{n}</span>
              <p className="font-display text-xl font-semibold leading-snug">{title}</p>
              <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
            </RevealItem>
          ))}
        </RevealOnScroll>
      </section>

      {/* ── Proof ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <RevealOnScroll className="text-center mb-14">
          <p className="text-bitcoin font-mono text-sm uppercase tracking-widest">The infrastructure is real.</p>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {PROOF_STATS.map(({ value, format, label }) => (
            <StatCard key={label} value={value} format={format} label={label} />
          ))}
        </RevealOnScroll>
        <RevealOnScroll className="text-center mt-8">
          <p className="text-zinc-600 text-sm">
            Yield rates are live today. BitYield is the interface that makes them accessible.
          </p>
        </RevealOnScroll>
      </section>

      {/* ── Trust ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <RevealOnScroll className="text-center mb-14">
          <p className="font-display text-3xl md:text-4xl font-bold mb-4">Built for Bitcoin holders.</p>
          <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
            Everything you need to earn on your Bitcoin — nothing you don&apos;t.
          </p>
        </RevealOnScroll>
        <RevealOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_POINTS.map(({ icon, title, desc }) => (
            <RevealItem
              key={title}
              className="glow-card bg-zinc-900/70 border border-zinc-800 rounded-2xl p-7 flex flex-col gap-4"
            >
              <div className="text-bitcoin w-fit p-2 rounded-lg bg-bitcoin/10">{icon}</div>
              <p className="font-display text-lg font-semibold">{title}</p>
              <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
            </RevealItem>
          ))}
        </RevealOnScroll>
      </section>

      {/* ── FAQ Section ── */}
      <section className="py-20 px-6 max-w-4xl mx-auto border-t border-zinc-900">
        <RevealOnScroll className="text-center mb-14">
          <p className="text-bitcoin font-mono text-sm uppercase tracking-widest mb-3">Common Questions</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">Frequently Asked Questions</h2>
        </RevealOnScroll>

        <RevealOnScroll stagger className="space-y-6">
          <RevealItem className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-display font-semibold text-lg text-white mb-2">Does my Bitcoin leave the Bitcoin L1 network?</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              No. Stacks sBTC uses a decentralized peg-in mechanism where your native Bitcoin remains on Bitcoin L1 under the custody of the Stacks consensus validators. You retain custody via your Stacks wallet keys, which are mapped 1:1 with your Bitcoin assets.
            </p>
          </RevealItem>

          <RevealItem className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-display font-semibold text-lg text-white mb-2">Why don&apos;t I need to hold or pay STX for gas?</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              BitYield abstracts gas fees entirely using Stacks sponsored transactions. When you sign a deposit or withdrawal, our sponsor node pays the STX network fee on the backend, ensuring a frictionless one-tap experience.
            </p>
          </RevealItem>

          <RevealItem className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-display font-semibold text-lg text-white mb-2">How are the yield rates generated?</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Today each strategy is a BitYield smart contract that pays a fixed, transparent APY and is labelled &quot;Preview&quot; in the app — you can verify every contract on-chain. Live routing into the underlying protocols (starting with Zest Protocol&apos;s Bitcoin lending, then Hermetica and Dual Stacking) is our next milestone, so deposits will earn real, market-driven protocol yield.
            </p>
          </RevealItem>

          <RevealItem className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-display font-semibold text-lg text-white mb-2">Can I withdraw my Bitcoin at any time?</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Yes, all positions are non-custodial and open-ended. You can trigger a withdrawal from the dashboard at any time, returning your principal along with all accrued yield directly to your Stacks wallet.
            </p>
          </RevealItem>
        </RevealOnScroll>
      </section>

      {/* ── Launch CTA ── */}
      <section id="launch" className="py-24 px-6 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Put your Bitcoin to work.</h2>
          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
            BitYield is live on Bitcoin mainnet. Connect your wallet, deposit sBTC,
            and start earning — with zero gas fees to pay.
          </p>
          <PrimaryLinkButton href="/deposit" className="px-10 py-5 text-lg">
            Launch App
          </PrimaryLinkButton>
          <p className="text-sm text-zinc-600 mt-6">
            Non-custodial. Withdraw anytime. No STX required.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <Logo />
          <p className="text-zinc-500">Built on Stacks. Secured by Bitcoin.</p>
        </div>
      </footer>

    </div>
  );
}
