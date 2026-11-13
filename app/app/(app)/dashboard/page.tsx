'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { formatApyPercent, formatBtc, satsToBtc } from '@/lib/stacks/format';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';
import { useAppData } from '@/lib/app-data';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { PrimaryButton } from '../../components/Button';
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, EarnIcon, RefreshIcon } from '../../components/app/Icons';
import { Card, Chip, SectionHeader, Skeleton, StrategyAvatar, TxRow, strategyLabel } from '../../components/app/ui';

function ActionButton({ href, label, children, primary }: { href: string; label: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className="group flex flex-1 flex-col items-center gap-2">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform group-active:scale-95 ${
          primary ? 'bg-bitcoin text-black group-hover:bg-bitcoin-dark' : 'border border-line bg-surface-2 text-zinc-200 group-hover:border-zinc-600'
        }`}
      >
        {children}
      </span>
      <span className="text-xs font-medium text-zinc-300">{label}</span>
    </Link>
  );
}

function SignedOut() {
  const { connect, isConnecting } = useWallet();
  const { bestApy } = useAppData();
  return (
    <motion.div initial="initial" animate="animate" variants={fadeSlideUp} className="pt-6 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bitcoin/10 text-bitcoin">
        <EarnIcon className="h-7 w-7" />
      </div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Hold Bitcoin. Earn Bitcoin.</h1>
      <p className="mx-auto mt-3 max-w-sm text-zinc-400 leading-relaxed">
        Connect your Stacks wallet to see your balance and start earning up to {formatApyPercent(bestApy)} APY on sBTC.
      </p>
      <PrimaryButton onClick={connect} loading={isConnecting} className="mt-8 w-full max-w-xs px-6 py-4 text-base">
        {isConnecting ? 'Connecting…' : 'Connect wallet'}
      </PrimaryButton>
    </motion.div>
  );
}

export default function HomePage() {
  const { isConnected } = useWallet();
  const d = useAppData();

  if (!isConnected) return <SignedOut />;

  const recent = (d.activity ?? []).slice(0, 4);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-8 xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start xl:gap-10 xl:space-y-0">
      <div className="space-y-8 xl:rounded-3xl xl:border xl:border-line xl:bg-surface xl:p-10 xl:pt-12">
      {/* Balance hero */}
      <motion.section variants={fadeSlideUp} className="pt-2 text-center">
        <p className="text-sm text-zinc-500">Total balance</p>
        {d.loading ? (
          <div className="mx-auto mt-3 flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-56" />
            <Skeleton className="h-5 w-32" />
          </div>
        ) : (
          <>
            <p className="mt-1 font-display text-5xl font-bold tabular-nums tracking-tight">
              <AnimatedNumber value={satsToBtc(d.totalSats)} formatter={(n) => n.toFixed(8)} />
              <span className="ml-2 text-xl font-semibold text-zinc-500">BTC</span>
            </p>
            {d.accruedYieldSats > 0n ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                +{formatBtc(d.accruedYieldSats)} BTC earned
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">Earning up to {formatApyPercent(d.bestApy)} APY</p>
            )}
          </>
        )}
      </motion.section>

      {/* Quick actions */}
      <motion.section variants={fadeSlideUp} className="flex items-start justify-center gap-4 px-2">
        <ActionButton href="/deposit" label="Deposit" primary>
          <ArrowDownIcon className="h-6 w-6" />
        </ActionButton>
        <ActionButton href="/withdraw" label="Withdraw">
          <ArrowUpIcon className="h-6 w-6" />
        </ActionButton>
        <ActionButton href="/earn" label="Earn">
          <EarnIcon className="h-6 w-6" />
        </ActionButton>
      </motion.section>

      {/* Split */}
      <motion.section variants={fadeSlideUp} className="grid grid-cols-2 gap-3">
        <Card className="p-4 xl:bg-surface-2">
          <p className="text-xs text-zinc-500">In wallet</p>
          {d.balanceError ? (
            <button
              onClick={d.retryBalance}
              disabled={d.balanceRetrying}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-amber-400 hover:underline disabled:opacity-60"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              {d.balanceRetrying ? 'Retrying…' : 'Retry'}
            </button>
          ) : d.balanceSats === null ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <p className="mt-1 font-mono text-base tabular-nums">{formatBtc(d.balanceSats)}</p>
          )}
        </Card>
        <Card className="p-4 xl:bg-surface-2">
          <p className="text-xs text-zinc-500">Earning</p>
          {d.positions === null ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <p className="mt-1 font-mono text-base tabular-nums">{formatBtc(d.earningSats)}</p>
          )}
        </Card>
      </motion.section>

      </div>

      <div className="space-y-8">
      {/* Positions */}
      {d.positions && d.positions.length === 0 && (
        <motion.section variants={fadeSlideUp}>
          <Card className="p-6 text-center">
            <p className="font-display text-lg font-semibold">Put your sBTC to work</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
              Deposit to start earning up to {formatApyPercent(d.bestApy)} APY, paid in Bitcoin. Your sBTC stays under
              your own keys until you deposit.
            </p>
            <Link
              href="/deposit"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-bitcoin px-6 py-3.5 font-bold text-black transition-colors hover:bg-bitcoin-dark sm:w-auto"
            >
              Start earning
            </Link>
          </Card>
        </motion.section>
      )}

      {d.positions && d.positions.length > 0 && (
        <motion.section variants={fadeSlideUp}>
          <SectionHeader title="Your positions" />
          <Card className="divide-y divide-line overflow-hidden">
            {d.positions.map((p) => (
              <Link
                key={p.id}
                href={`/withdraw?position=${p.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-2"
              >
                <StrategyAvatar name={p.strategy} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{strategyLabel(p.strategy)}</p>
                    {p.yieldIsLive ? (
                      <Chip tone="green" title="Earned amount read directly from the protocol's on-chain balance, not estimated.">
                        Live
                      </Chip>
                    ) : (
                      <Chip tone="gray" title="Earned amount is a projection from the strategy's fixed APY.">
                        Estimated
                      </Chip>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatApyPercent(p.displayApyPercent)} APY · +{formatBtc(p.accruedYieldSats)} earned
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="font-mono text-sm tabular-nums">{formatBtc(p.amountSats + p.accruedYieldSats)}</p>
                  <ChevronRightIcon className="h-4 w-4 text-zinc-600" />
                </div>
              </Link>
            ))}
          </Card>
        </motion.section>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <motion.section variants={fadeSlideUp}>
          <SectionHeader title="Recent activity" href="/activity" />
          <Card className="divide-y divide-line overflow-hidden">
            {recent.map((t) => (
              <TxRow key={t.txid} tx={t} />
            ))}
          </Card>
        </motion.section>
      )}
    </div>
    </motion.div>
  );
}
