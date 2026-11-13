'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { getPositions, type Position } from '@/lib/stacks/contract';
import { submitWithdrawTx, type TxPhase } from '@/lib/stacks/tx';
import { trackEvent } from '@/lib/track';
import { type StrategyName, explorerTxUrl } from '@/lib/stacks/network';
import { formatBtc, satsToBtc, formatApyPercent } from '@/lib/stacks/format';
import { fadeSlideUp } from '@/lib/motion';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { ErrorCard, PendingCard, SuccessCard } from '../components/TransactionStatus';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PrimaryButton, PrimaryLinkButton } from '../components/Button';
import { FlowShell } from '../components/app/FlowShell';
import { Chip, Skeleton, StrategyAvatar, SummaryRow, strategyLabel } from '../components/app/ui';
import { ChevronRightIcon } from '../components/app/Icons';

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
    const eventBase = {
      wallet: address ?? undefined,
      strategy: selected.strategy,
      positionId: Number(selected.id),
      amountSats: Number(selected.amountSats),
    };
    trackEvent('withdraw_attempted', eventBase);
    let lastTxid: string | undefined;
    try {
      const outcome = await submitWithdrawTx(selected.id, selected.strategy as StrategyName, {
        onPhase: setPhase,
        onTxId: (id) => {
          lastTxid = id;
          setTxid(id);
        },
      });
      if (outcome.status === 'success') {
        setWithdrawnTotalSats(selected.amountSats + selected.accruedYieldSats);
        await refreshPositions();
        setStep('success');
        trackEvent('withdraw_completed', { ...eventBase, txid: outcome.txid });
      } else if (outcome.status === 'cancelled') {
        setStep('confirm');
      } else if (outcome.status === 'timeout') {
        trackEvent('withdraw_failed', { ...eventBase, reason: 'timeout', txid: lastTxid });
        setErrorMessage(
          'This is taking longer than expected. Your withdrawal may still confirm. Check back in a few minutes before trying again.'
        );
        setStep('error');
      } else {
        trackEvent('withdraw_failed', { ...eventBase, reason: 'failed', txid: lastTxid });
        setErrorMessage(
          'This sometimes happens when network conditions change. Your position has not changed.'
        );
        setStep('error');
      }
    } catch (err) {
      trackEvent('withdraw_failed', { ...eventBase, reason: 'error', txid: lastTxid });
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const totalSats = selected ? selected.amountSats + selected.accruedYieldSats : 0n;
  const apy = selected ? selected.displayApyPercent : 0;


  const goToList = () => {
    setSelected(null);
    setStep('select');
  };

  const shellTitle =
    step === 'confirm' ? 'Review withdrawal' : step === 'pending' ? 'Withdrawing' : step === 'success' ? 'Done' : step === 'error' ? 'Withdrawal failed' : 'Withdraw';
  const showProgress = isConnected && (step === 'select' || step === 'confirm') && positions !== null && positions.length > 0;

  return (
    <FlowShell
      title={shellTitle}
      step={showProgress ? (step === 'select' ? 1 : 2) : undefined}
      total={showProgress ? 2 : undefined}
      onBack={step === 'confirm' && !preselectId ? goToList : undefined}
      close={step === 'success' || step === 'error'}
      footer={
        step === 'confirm' && selected ? (
          <PrimaryButton onClick={handleConfirm} className="w-full px-6 py-4 text-base">
            Confirm withdrawal
          </PrimaryButton>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {!isConnected && step === 'select' && (
          <motion.div key="connect" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="my-auto">
            <ConnectPrompt description="Connect your Stacks wallet to see your positions and withdraw." />
          </motion.div>
        )}

        {isConnected && step === 'select' && positions === null && (
          <motion.div key="loading" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="space-y-3 pt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </motion.div>
        )}

        {isConnected && step === 'select' && positions !== null && positions.length === 0 && (
          <motion.div key="empty" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="my-auto text-center">
            <p className="font-display text-xl font-semibold mb-2">Nothing to withdraw yet</p>
            <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-zinc-400">
              You don&apos;t have any open positions. Make a deposit to start earning, then come back here anytime to
              withdraw.
            </p>
            <PrimaryLinkButton href="/deposit" className="w-full px-6 py-4 text-base">
              Make a deposit
            </PrimaryLinkButton>
          </motion.div>
        )}

        {isConnected && step === 'select' && positions !== null && positions.length > 0 && (
          <motion.div key="list" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="space-y-4">
            <p className="text-sm text-zinc-500">Choose a position to withdraw. Everything earned so far comes with it.</p>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {positions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    setStep('confirm');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-2"
                >
                  <StrategyAvatar name={p.strategy} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{strategyLabel(p.strategy)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatApyPercent(p.displayApyPercent)} APY · +{formatBtc(p.accruedYieldSats)} earned
                    </p>
                  </div>
                  <p className="font-mono text-sm tabular-nums">{formatBtc(p.amountSats + p.accruedYieldSats)}</p>
                  <ChevronRightIcon className="h-4 w-4 text-zinc-600" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'confirm' && selected && (
          <motion.div key="confirm" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="space-y-5">
            <div className="pt-2 text-center">
              <p className="text-sm text-zinc-500">You receive</p>
              <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight">
                <AnimatedNumber value={satsToBtc(totalSats)} formatter={(n) => n.toFixed(8)} />
                <span className="ml-2 text-lg font-semibold text-zinc-500">BTC</span>
              </p>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              <SummaryRow label="From">
                <span className="inline-flex items-center gap-2">
                  {strategyLabel(selected.strategy)}
                  {selected.yieldIsLive ? <Chip tone="green">Live</Chip> : <Chip tone="gray">Estimated</Chip>}
                </span>
              </SummaryRow>
              <SummaryRow label="Principal">
                <span className="font-mono">{formatBtc(selected.amountSats)} BTC</span>
              </SummaryRow>
              <SummaryRow label="Yield earned">
                <span className="font-mono text-emerald-400">+{formatBtc(selected.accruedYieldSats)} BTC</span>
              </SummaryRow>
              <SummaryRow label="Rate">{formatApyPercent(apy)} APY</SummaryRow>
            </div>

            <p className="text-center text-sm leading-relaxed text-zinc-500">
              Your full balance, including everything earned so far, is sent back to your wallet on Bitcoin L1.
            </p>
          </motion.div>
        )}

        {step === 'pending' && (
          <motion.div key="pending" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            <PendingCard phase={phase} explorerUrl={txid ? explorerTxUrl(txid) : undefined} footer={`Withdrawing ${formatBtc(totalSats)} BTC`} />
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            <SuccessCard
              title="Withdrawal complete"
              description={`${formatBtc(withdrawnTotalSats)} BTC has been sent back to your wallet on Bitcoin L1.`}
              onDone={() => router.push('/dashboard')}
              doneLabel="Back to Home"
              explorerUrl={txid ? explorerTxUrl(txid) : undefined}
            />
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            <ErrorCard
              title="We couldn't confirm your withdrawal"
              description={errorMessage ?? 'Something went wrong. Your position has not changed. Please try again.'}
              onCancel={goToList}
              onRetry={() => setStep('confirm')}
              explorerUrl={txid ? explorerTxUrl(txid) : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </FlowShell>
  );
}

export default function WithdrawPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0a0a0a]" />}>
      <WithdrawPageInner />
    </Suspense>
  );
}
