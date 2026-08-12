import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '../components/Logo';
import { ConnectWalletButton } from '../components/ConnectWalletButton';
import { PrimaryLinkButton } from '../components/Button';
import { DocsToc } from '../components/DocsToc';

export const metadata: Metadata = {
  title: 'Documentation · BitYield',
  description:
    'Get started with BitYield: connect a wallet, get sBTC, deposit into a yield route, track your position, and withdraw. Plus how routing, fees, and self-custody work.',
};

const TOC: { id: string; label: string }[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'get-started', label: 'Get started' },
  { id: 'yield-routes', label: 'Yield routes' },
  { id: 'fees', label: 'Fees and gas' },
  { id: 'security', label: 'Security and custody' },
  { id: 'verify', label: 'Verify on-chain' },
  { id: 'faq', label: 'FAQ' },
  { id: 'resources', label: 'Resources' },
];

function Pill({ tone, children }: { tone: 'live' | 'soon' | 'preview'; children: ReactNode }) {
  const styles = {
    live: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    soon: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    preview: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }[tone];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${styles}`}>
      {children}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-zinc-800/60 pt-12 first:border-t-0 first:pt-0">
      <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-5">{title}</h2>
      <div className="space-y-4 text-zinc-400 leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-bitcoin/10 border border-bitcoin/25 text-bitcoin font-bold flex items-center justify-center tabular-nums">
        {n}
      </div>
      <div className="space-y-1.5 pt-0.5">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Callout({ tone = 'note', children }: { tone?: 'note' | 'warn'; children: ReactNode }) {
  const border = tone === 'warn' ? 'border-amber-500/25' : 'border-zinc-800';
  return (
    <div className={`bg-zinc-950 border ${border} rounded-xl p-4 text-sm text-zinc-400 leading-relaxed`}>
      {children}
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[12px] text-zinc-300 bg-black border border-zinc-800 rounded px-1.5 py-0.5 break-all">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
      <nav className="fixed top-0 inset-x-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-md">
        <Logo />
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/#waitlist" className="hidden md:block text-sm text-zinc-400 hover:text-white transition-colors">Waitlist</Link>
          <Link href="/proof" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">Proof</Link>
          <Link href="/docs" className="hidden sm:block text-sm text-white transition-colors">Docs</Link>
          <ConnectWalletButton />
          <span className="hidden sm:inline-flex">
            <PrimaryLinkButton href="/dashboard" className="px-5 py-2 text-sm">Launch App</PrimaryLinkButton>
          </span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        <header className="mb-14">
          <p className="text-bitcoin text-xs uppercase tracking-widest font-mono mb-3">Documentation</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Get started with BitYield
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
            BitYield turns your Bitcoin into productive Bitcoin in under two minutes, with no prior
            knowledge of Stacks, sBTC, or DeFi. This guide covers everything from connecting a wallet
            to how routing, fees, and self-custody work under the hood.
          </p>
        </header>

        <div className="grid lg:grid-cols-[210px_1fr] gap-12">
          {/* Table of contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3">On this page</p>
              <DocsToc items={TOC} />
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-12 min-w-0">
            <Section id="introduction" title="Introduction">
              <p>
                Most Bitcoin earns nothing. The paths that do exist usually ask you to bridge your
                BTC to another chain, wrap it into a token you do not recognise, learn a DeFi
                interface, or pay gas in a token you do not hold. BitYield removes all of that.
              </p>
              <p>
                You connect a wallet, deposit sBTC (a 1:1 Bitcoin-backed asset), pick a yield route,
                and confirm. Your Bitcoin stays Bitcoin, secured by Bitcoin L1 under your own keys,
                and it starts earning. Every transaction fee is sponsored, so you never need to hold
                or spend STX.
              </p>
            </Section>

            <Section id="how-it-works" title="How it works">
              <p>The experience is four steps:</p>
              <p className="font-mono text-sm text-zinc-300 bg-black border border-zinc-800 rounded-xl p-4">
                Connect wallet → See your Bitcoin → Choose a yield route → One tap to deploy
              </p>
              <p>Three things about Stacks make this possible:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="text-zinc-300 font-medium">Your Bitcoin stays Bitcoin.</span> sBTC
                  is 1:1 Bitcoin-backed. When you deposit, your Bitcoin stays on Bitcoin L1 under your
                  own keys. No bridge risk, no wrapped-token risk.
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">The yield is real and on-chain.</span>{' '}
                  Stacks hosts production protocols paying Bitcoin-denominated yield, verifiable on a
                  public explorer.
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">The friction is removed.</span> BitYield
                  sponsors network fees, so you deposit and withdraw without ever touching STX.
                </li>
              </ul>
            </Section>

            <Section id="get-started" title="Get started">
              <div className="space-y-7">
                <Step n={1} title="Connect a wallet">
                  <p>
                    Open the app and connect a Stacks wallet such as Leather. BitYield never takes
                    custody of your funds or asks for your seed phrase. Connecting only lets the app
                    read your balance and prepare transactions for you to sign.
                  </p>
                </Step>
                <Step n={2} title="Get sBTC">
                  <p>
                    sBTC is Bitcoin you can put to work on Stacks, redeemable 1:1 for BTC at any time.
                    If you do not have sBTC yet, use the official sBTC bridge (linked from the deposit
                    screen): send BTC, receive sBTC. BitYield does not bridge funds itself, it links
                    you to the real flow.
                  </p>
                </Step>
                <Step n={3} title="Make a deposit">
                  <p>
                    Go to Deposit, enter an amount, and choose a yield route. You will see the route,
                    the expected rate, and a plain-language risk panel before you confirm. Confirming
                    signs a single transaction. The fee is sponsored, so you pay zero STX.
                  </p>
                </Step>
                <Step n={4} title="Track your position">
                  <p>
                    Your position shows up on the Dashboard: how much you deposited, which route it is
                    in, and your earnings, all denominated in Bitcoin. The Proof page shows every
                    BitYield transaction live from the chain, with explorer links.
                  </p>
                </Step>
                <Step n={5} title="Withdraw">
                  <p>
                    Withdraw at any time from the Dashboard. BitYield returns your principal plus
                    accrued yield to your wallet in a single sponsored transaction. Only you can
                    withdraw your own position.
                  </p>
                </Step>
              </div>
            </Section>

            <Section id="yield-routes" title="Yield routes">
              <p>
                BitYield routes deposits through a non-custodial router into pluggable strategy
                contracts, each targeting a different Bitcoin yield source. Adding a route never
                touches your existing positions.
              </p>
              <div className="space-y-3">
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white">Zest</span>
                    <Pill tone="preview">Live routing rolling out</Pill>
                  </div>
                  <p className="text-sm">
                    Lending yield: you supply sBTC, borrowers pay interest, you earn it. Bitcoin in,
                    Bitcoin out, with no impermanent loss.
                  </p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white">Dual Stacking</span>
                    <Pill tone="preview">Live routing rolling out</Pill>
                  </div>
                  <p className="text-sm">
                    The Stacks network&apos;s own Bitcoin rewards program. Your sBTC is never locked or
                    moved, and rewards are paid in sBTC.
                  </p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white">Bitflow, Hermetica</span>
                    <Pill tone="soon">Roadmap</Pill>
                  </div>
                  <p className="text-sm">
                    Trading-fee yield (Bitflow) and a future USD / stablecoin track (Hermetica) are
                    planned once the first two routes are fully live.
                  </p>
                </div>
              </div>
              <Callout tone="warn">
                <span className="text-zinc-300 font-medium">Current status.</span> Today each route is
                a BitYield strategy contract that models its target protocol and pays a set rate. Live
                routing into the underlying protocols is being rolled out and labelled clearly in the
                app. The route you pick, its rate, and its risks are always shown before you confirm.
              </Callout>
            </Section>

            <Section id="fees" title="Fees and gas">
              <p>
                Stacks transactions normally require a fee paid in STX. BitYield sponsors that fee for
                you, so you never need to acquire, hold, or spend STX to deposit or withdraw.
              </p>
              <Callout>
                Fee sponsorship is part of early access and will not run forever. Even when network
                fees become yours to cover, you will not need to hold STX: a small fee can be settled
                in sBTC or taken from the yield you have already earned.
              </Callout>
            </Section>

            <Section id="security" title="Security and custody">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="text-zinc-300 font-medium">Self-custody.</span> Your Bitcoin is held
                  as sBTC, secured by Bitcoin L1 consensus, with no third-party wrapping or bridge
                  custodian. Only you can withdraw your position.
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">Non-custodial router.</span> BitYield&apos;s
                  router is a routing and accounting layer. It records your deposit to your address and
                  delegates custody to the strategy contract you chose.
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">Honest scope.</span> The contracts are
                  running as a controlled demo and are not yet independently audited, and ownership is
                  a single key today. A public launch is gated on an independent audit and moving
                  ownership to a multisig. Deposit only what you are comfortable testing with.
                </li>
              </ul>
            </Section>

            <Section id="verify" title="Verify on-chain">
              <p>
                Everything BitYield does is public and verifiable. You can read the router and each
                strategy contract on the explorer, and the Proof page reads BitYield&apos;s real
                transaction history straight from the chain.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Router: <Mono>SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN.yield-router</Mono>
                </li>
                <li>
                  sBTC token: <Mono>SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token</Mono>
                </li>
              </ul>
              <p>
                <Link href="/proof" className="text-bitcoin hover:underline font-medium">
                  Open the Proof page →
                </Link>
              </p>
            </Section>

            <Section id="faq" title="FAQ">
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-white mb-1">Do I need STX?</h3>
                  <p className="text-sm">
                    No. Fees are sponsored, so you only ever need sBTC (which is 1:1 Bitcoin).
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Is my Bitcoin bridged to another chain?</h3>
                  <p className="text-sm">
                    No. sBTC is 1:1 Bitcoin-backed and secured by Bitcoin L1. Your Bitcoin does not
                    leave Bitcoin, it just starts working.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Can BitYield move my funds?</h3>
                  <p className="text-sm">
                    No. Positions are recorded to your address, and only you can withdraw yours.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">How is yield paid?</h3>
                  <p className="text-sm">
                    In Bitcoin terms. You withdraw principal plus accrued yield back to your wallet as
                    sBTC, redeemable 1:1 for BTC.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">What are the risks?</h3>
                  <p className="text-sm">
                    Smart-contract risk (the contracts are not yet audited), and route-specific risk
                    shown before each deposit. Start small.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="resources" title="Resources">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <Link href="/deposit" className="text-bitcoin hover:underline">Deposit</Link>{' '}
                  — start earning.
                </li>
                <li>
                  <Link href="/dashboard" className="text-bitcoin hover:underline">Dashboard</Link>{' '}
                  — track and withdraw your positions.
                </li>
                <li>
                  <Link href="/proof" className="text-bitcoin hover:underline">Proof</Link>{' '}
                  — every BitYield transaction, live from the chain.
                </li>
                <li>
                  <a href="https://www.stacks.co/sbtc" target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:underline">
                    About sBTC ↗
                  </a>
                </li>
              </ul>
              <div className="pt-4">
                <PrimaryLinkButton href="/deposit" className="px-6 py-3">Start earning →</PrimaryLinkButton>
              </div>
            </Section>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <Logo />
          <div className="flex items-center gap-6 text-zinc-500">
            <Link href="/dashboard" className="hover:text-white transition-colors">App</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/proof" className="hover:text-white transition-colors">Proof</Link>
            <span>Built on Stacks · Secured by Bitcoin</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
