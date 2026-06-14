'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/lib/stacks/wallet';
import { getPositions, type Position } from '@/lib/stacks/contract';
import { submitWithdrawTx, type TxPhase } from '@/lib/stacks/tx';
import { formatBtc } from '@/lib/stacks/format';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { ErrorCard, PendingCard, SuccessCard } from '../components/TransactionStatus';

type Step = 'select' | 'confirm' | 'pending' | 'success' | 'error';

function WithdrawPageInner() {
  const { address, isConnected } = useWallet();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get('position');

  const [step, setStep] = useState<Step>('select');
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [phase, setPhase] = useState<TxPhase>('signing');
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
    try {
      const outcome = await submitWithdrawTx(selected.id, { onPhase: setPhase });
      if (outcome.status === 'success') {
        setWithdrawnTotalSats(selected.amountSats + selected.accruedYieldSats);
        await refreshPositions();
        setStep('success');
      } else if (outcome.status === 'cancelled') {
        setStep('confirm');
      } else if (outcome.status === 'timeout') {
        setErrorMessage(
          'This is taking longer than expected. Your withdrawal may still confirm — check back in a few minutes before trying again.'
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
        <Link href="/" className="font-bold text-xl tracking-tight select-none">
          Bit<span className="text-[#F7931A]">Yield</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Back to Dashboard
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {!isConnected && step === 'select' && (
            <ConnectPrompt description="Connect your Stacks wallet to see your positions and withdraw." />
          )}

          {isConnected && step === 'select' && positions === null && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-10 h-10 border-4 border-zinc-700 border-t-[#F7931A] rounded-full animate-spin" />
              </div>
              <p className="text-zinc-400">Loading your positions…</p>
            </div>
          )}

          {isConnected && step === 'select' && positions !== null && positions.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <p className="text-xl font-semibold mb-2">Nothing to withdraw yet</p>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                You don&apos;t have any open positions. Make a deposit to start earning, then come
                back here anytime to withdraw.
              </p>
              <Link
                href="/deposit"
                className="inline-block w-full bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
              >
                Make a Deposit
              </Link>
            </div>
          )}

          {isConnected && step === 'select' && positions !== null && positions.length > 0 && (
            <div className="space-y-4">
              <p className="text-zinc-500 text-sm uppercase tracking-widest">Your Positions</p>
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
                      {formatBtc(p.amountSats)} BTC principal + {formatBtc(p.accruedYieldSats)} BTC
                      earned · {p.apyBps / 100}% APY
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setStep('confirm');
                    }}
                    className="bg-[#F7931A] text-black font-bold px-5 py-3 rounded-xl hover:bg-[#e8841a] transition-colors whitespace-nowrap"
                  >
                    Withdraw
                  </button>
                </div>
              ))}
            </div>
          )}

          {step === 'confirm' && selected && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <p className="text-zinc-500 text-sm uppercase tracking-widest mb-6">
                Review Withdrawal
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">You receive</span>
                  <span className="text-2xl font-bold">{formatBtc(totalSats)} BTC</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">Principal</span>
                  <span className="font-mono">{formatBtc(selected.amountSats)} BTC</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">Yield earned</span>
                  <span className="font-mono text-[#F7931A]">
                    +{formatBtc(selected.accruedYieldSats)} BTC
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">APY</span>
                  <span>{apy}%, paid in Bitcoin</span>
                </div>
              </div>

              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                Your full balance, including everything earned so far, is sent back to your
                wallet on Bitcoin L1.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelected(null);
                    setStep('select');
                  }}
                  className="flex-1 border border-zinc-700 text-zinc-300 font-semibold px-6 py-4 rounded-xl hover:border-zinc-500 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
                >
                  Confirm Withdrawal
                </button>
              </div>
            </div>
          )}

          {step === 'pending' && (
            <PendingCard phase={phase} footer={`Withdrawing ${formatBtc(totalSats)} BTC`} />
          )}

          {step === 'success' && (
            <SuccessCard
              title="Withdrawal complete"
              description={`${formatBtc(withdrawnTotalSats)} BTC has been sent back to your wallet on Bitcoin L1.`}
              onDone={() => {
                setSelected(null);
                setStep('select');
              }}
            >
              <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8">
                <p className="text-zinc-500 text-sm">
                  <Link href="/dashboard" className="text-[#F7931A] hover:underline">
                    View your dashboard
                  </Link>
                </p>
              </div>
            </SuccessCard>
          )}

          {step === 'error' && (
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
          )}
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
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-[#F7931A] rounded-full animate-spin" />
        </div>
      }
    >
      <WithdrawPageInner />
    </Suspense>
  );
}
