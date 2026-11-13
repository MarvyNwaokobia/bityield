'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatApyPercent } from '@/lib/stacks/format';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';
import { STRATEGY_OPTIONS } from '@/lib/strategies';
import { useAppData } from '@/lib/app-data';
import { Card, Chip, PageTitle, StrategyAvatar } from '../../components/app/ui';

export default function EarnPage() {
  const { liveApy, bestApy } = useAppData();

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={fadeSlideUp}>
        <PageTitle sub={`Pick a route. Rates are read live from the protocols. Best today: ${formatApyPercent(bestApy)} APY.`}>
          Earn
        </PageTitle>
      </motion.div>

      <div className="space-y-4">
        {STRATEGY_OPTIONS.map((s) => {
          const live = s.status === 'live';
          const rate = liveApy[s.id] ?? s.apy;
          const isLiveRate = liveApy[s.id] !== undefined;
          return (
            <motion.div key={s.id} variants={fadeSlideUp}>
              <Card className={`p-5 ${live ? '' : 'opacity-80'}`}>
                <div className="flex items-start gap-3">
                  <StrategyAvatar name={s.id} className="h-11 w-11 text-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold">{s.name}</p>
                      {live ? <Chip tone="green">Live</Chip> : <Chip tone="gray">Preview</Chip>}
                    </div>
                    <p className="text-xs text-zinc-500">via {s.targetProtocol} · {s.risk} risk</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold tabular-nums text-bitcoin">{formatApyPercent(rate)}</p>
                    <p className="text-[11px] text-zinc-500">{isLiveRate ? 'APY, live' : 'APY'}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-zinc-400">{s.desc}</p>

                {live ? (
                  <Link
                    href={`/deposit?strategy=${s.id}`}
                    className="mt-5 flex w-full items-center justify-center rounded-xl bg-bitcoin px-6 py-3.5 font-bold text-black transition-colors hover:bg-bitcoin-dark"
                  >
                    Deposit
                  </Link>
                ) : (
                  <p className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-zinc-500">
                    Not available to deposit yet
                  </p>
                )}

                <details className="group mt-4">
                  <summary className="cursor-pointer list-none text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300">
                    <span className="group-open:hidden">Risk and disclosures</span>
                    <span className="hidden group-open:inline">Hide risk and disclosures</span>
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-500">{s.riskNote}</p>
                </details>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
