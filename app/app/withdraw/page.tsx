'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Logo } from '../components/Logo';
import { AnimatePresence, motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { getPositions, type Position } from '@/lib/stacks/contract';
import { submitWithdrawTx, type TxPhase } from '@/lib/stacks/tx';
import { type StrategyName, explorerTxUrl } from '@/lib/stacks/network';
import { formatBtc, satsToBtc } from '@/lib/stacks/format';
import { fadeSlideUp, hoverScale, springTransition, staggerContainer } from '@/lib/motion';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { ErrorCard, PendingCard, SuccessCard } from '../components/TransactionStatus';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PrimaryButton, PrimaryLinkButton, SecondaryButton } from '../components/Button';

type Step = 'select' | 'confirm' | 'pending' | 'success' | 'error';

function WithdrawPageInner() {
  const { address, isConnected } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get('position');

  const [step, setStep] = useState<Step>('select');
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [phase, setPhase] = useState<TxPhase>('signing');
  const [txid, setTxid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [withdrawnTotalSats, setWithdrawnTotalSats] = useState(0n);

  const refreshPositions = useCallback(async () => {
    if (!address) return;
    const fetched = await getPositions(address);
    setPositions(fetched);

    if (preselectId) {
      const match = fetched.find((p) => p.id === Number(preselectId));
      if (match) {
        setSelected(match);
        setStep('confirm');
      }
    }
  }, [address, preselectId]);

  useEffect(() => {
    (async () => {
      await refreshPositions();
    })();
  }, [refreshPositions]);

  const handleConfirm = async () => {
    if (!selected) return;
    setStep('pending');
    setErrorMessage(null);
    setPhase('signing');
    setTxid(null);
    try {
      const outcome = await submitWithdrawTx(selected.id, selected.strategy as StrategyName, { onPhase: setPhase, onTxId: setTxid });
      if (outcome.status === 'success') {
        setWithdrawnTotalSats(selected.amountSats + selected.accruedYieldSats);
        await refreshPositions();
        setStep('success');
      } else if (outcome.status === 'cancelled') {
        setStep('confirm');
      } else if (outcome.status === 'timeout') {
        setErrorMessage(
          'This is taking longer than expected. Your withdrawal may still confirm. Check back in a few minutes before trying again.'
        );
        setStep('error');
      } else {
        setErrorMessage(
          'This sometimes happens when network conditions change. Your position has not changed.'
        );
        setStep('error');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const totalSats = selected ? selected.amountSats + selected.accruedYieldSats : 0n;
  const apy = selected ? selected.apyBps / 100 : 0;

  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50">
        <Logo />
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Back to Dashboard
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {!isConnected && step === 'select' && (
              <motion.div key="connect" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <ConnectPrompt description="Connect your Stacks wallet to see your positions and withdraw." />
              </motion.div>
            )}

            {isConnected && step === 'select' && positions === null && (
              <motion.div
                key="loading"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeSlideUp}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-10 h-10 border-4 border-zinc-700 border-t-bitcoin rounded-full animate-spin" />
                </div>
                <p className="text-zinc-400">Loading your positions…</p>
              </motion.div>
            )}

            {isConnected && step === 'select' && positions !== null && positions.length === 0 && (
              <motion.div
                key="empty"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeSlideUp}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
              >
                <p className="text-xl font-semibold mb-2">Nothing to withdraw yet</p>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  You don&apos;t have any open positions. Make a deposit to start earning, then come
                  back here anytime to withdraw.
                </p>
                <PrimaryLinkButton href="/deposit" className="w-full px-6 py-4">
                  Make a Deposit
                </PrimaryLinkButton>
              </motion.div>
            )}

            {isConnected && step === 'select' && positions !== null && positions.length > 0 && (
              <motion.div
                key="list"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={staggerContainer}
                className="space-y-4"
              >
                <motion.p variants={fadeSlideUp} className="text-zinc-500 text-sm uppercase tracking-widest">
                  Your Positions
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
                          {formatBtc(p.amountSats + p.accruedYieldSats)} BTC
                        </p>
                        <p className="text-zinc-500 text-sm mt-1">
                          {formatBtc(p.amountSats)} BTC principal + {formatBtc(p.accruedYieldSats)} BTC
                          earned · {p.apyBps / 100}% APY
                        </p>
                      </div>
                      <PrimaryButton
                        onClick={() => {
                          setSelected(p);
                          setStep('confirm');
                        }}
                        className="px-5 py-3 whitespace-nowrap"
                      >
                        Withdraw
                      </PrimaryButton>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {step === 'confirm' && selected && (
              <motion.div
                key="confirm"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeSlideUp}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
              >
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-6">
                  Review Withdrawal
                </p>

                <motion.div
                  initial="initial"
                  animate="animate"
                  variants={staggerContainer}
                  className="space-y-4 mb-8"
                >
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">You receive</span>
                    <span className="font-display text-2xl font-bold">
                      <AnimatedNumber value={satsToBtc(totalSats)} formatter={(n) => n.toFixed(8)} /> BTC
                    </span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">Strategy</span>
                    <span className="font-semibold uppercase tracking-wider text-[10px] bg-bitcoin/10 text-bitcoin border border-bitcoin/20 px-2 py-0.5 rounded-full">
                      {selected.strategy === 'zest' ? 'Zest Lending' : selected.strategy === 'hermetica' ? 'Hermetica Structured' : selected.strategy === 'dual-stacking' ? 'Dual Stacking' : 'Mock Yield'}
                    </span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">Principal</span>
                    <span className="font-mono">{formatBtc(selected.amountSats)} BTC</span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">Yield earned</span>
                    <span className="font-mono text-bitcoin">
                      +{formatBtc(selected.accruedYieldSats)} BTC
                    </span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">APY</span>
                    <span>{apy}%, paid in Bitcoin</span>
                  </motion.div>
                </motion.div>

                <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                  Your full balance, including everything earned so far, is sent back to your
                  wallet on Bitcoin L1.
                </p>

                <div className="flex gap-3">
                  <SecondaryButton
                    onClick={() => {
                      setSelected(null);
                      setStep('select');
                    }}
                    className="flex-1 px-6 py-4"
                  >
                    Back
                  </SecondaryButton>
                  <PrimaryButton onClick={handleConfirm} className="flex-1 px-6 py-4">
                    Confirm Withdrawal
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 'pending' && (
              <motion.div key="pending" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <PendingCard phase={phase} explorerUrl={txid ? explorerTxUrl(txid) : undefined} footer={`Withdrawing ${formatBtc(totalSats)} BTC`} />
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <SuccessCard
                  title="Withdrawal complete"
                  description={`${formatBtc(withdrawnTotalSats)} BTC has been sent back to your wallet on Bitcoin L1.`}
                  onDone={() => router.push('/dashboard')}
                  doneLabel="View dashboard"
                >
                  <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8">
                    <p className="text-zinc-500 text-sm">
                      <Link href="/dashboard" className="text-bitcoin hover:underline">
                        View your dashboard
                      </Link>
                    </p>
                  </div>
                </SuccessCard>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div key="error" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <ErrorCard
                  title="We couldn't confirm your withdrawal"
                  description={
                    errorMessage ?? 'Something went wrong. Your position has not changed. Please try again.'
                  }
                  onCancel={() => {
                    setSelected(null);
                    setStep('select');
                  }}
                  onRetry={() => setStep('confirm')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function WithdrawPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#0a0a0a] text-white min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-bitcoin rounded-full animate-spin" />
        </div>
      }
    >
      <WithdrawPageInner />
    </Suspense>
  );
}
