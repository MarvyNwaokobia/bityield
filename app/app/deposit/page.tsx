'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/stacks/wallet';
import { getSbtcBalanceSats } from '@/lib/stacks/balances';
import { DEFAULT_APY_BPS, getBestRate } from '@/lib/stacks/contract';
import { submitDepositTx, type TxPhase } from '@/lib/stacks/tx';
import { satsToBtc, SATS_PER_BTC } from '@/lib/stacks/format';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { ErrorCard, PendingCard, SuccessCard } from '../components/TransactionStatus';

type Step = 'amount' | 'confirm' | 'pending' | 'success' | 'error';

export default function DepositPage() {
  const { address, isConnected } = useWallet();

  const [step, setStep] = useState<Step>('amount');
  const [balanceSats, setBalanceSats] = useState<bigint | null>(null);
  const [apyBps, setApyBps] = useState<number>(DEFAULT_APY_BPS);
  const [amount, setAmount] = useState('0');
  const [phase, setPhase] = useState<TxPhase>('signing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depositedSats, setDepositedSats] = useState(0);

  useEffect(() => {
    getBestRate().then((rate) => setApyBps(rate.apyBps));
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    const sats = await getSbtcBalanceSats(address);
    setBalanceSats(sats);
    setAmount(satsToBtc(sats).toFixed(8));
  }, [address]);

  useEffect(() => {
    (async () => {
      await refreshBalance();
    })();
  }, [refreshBalance]);

  const apy = apyBps / 100;
  const balanceBtc = balanceSats !== null ? satsToBtc(balanceSats) : 0;
  const numericAmount = Math.min(Math.max(Number(amount) || 0, 0), balanceBtc);
  const overBalance = Number(amount) > balanceBtc;
  const monthlyEarnings = (numericAmount * (apy / 100)) / 12;
  const amountSats = Math.round(numericAmount * SATS_PER_BTC);

  const handleConfirm = async () => {
    setStep('pending');
    setErrorMessage(null);
    setPhase('signing');
    try {
      const outcome = await submitDepositTx(amountSats, { onPhase: setPhase });
      if (outcome.status === 'success') {
        setDepositedSats(amountSats);
        await refreshBalance();
        setStep('success');
      } else if (outcome.status === 'cancelled') {
        setStep('confirm');
      } else if (outcome.status === 'timeout') {
        setErrorMessage(
          'This is taking longer than expected. Your transaction may still confirm — check your dashboard in a few minutes before trying again.'
        );
        setStep('error');
      } else {
        setErrorMessage(
          'This sometimes happens when network conditions change. Your sBTC has not moved and your balance is unaffected.'
        );
        setStep('error');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  };

  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50">
        <Link href="/" className="font-bold text-xl tracking-tight select-none">
          Bit<span className="text-[#F7931A]">Yield</span>
        </Link>
        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Back
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {!isConnected && step === 'amount' && (
            <ConnectPrompt description="Connect your Stacks wallet to see your sBTC balance and start earning." />
          )}

          {isConnected && step === 'amount' && balanceSats === null && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-10 h-10 border-4 border-zinc-700 border-t-[#F7931A] rounded-full animate-spin" />
              </div>
              <p className="text-zinc-400">Loading your balance…</p>
            </div>
          )}

          {isConnected && step === 'amount' && balanceSats !== null && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                Your Balance
              </p>
              <p className="text-4xl font-bold mb-8">{balanceBtc.toFixed(8)} BTC</p>

              {balanceSats === 0n ? (
                <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                  Your wallet doesn&apos;t have any sBTC yet. Get testnet sBTC, then come back
                  here to start earning.
                </p>
              ) : (
                <>
                  <label htmlFor="amount" className="block text-sm text-zinc-400 mb-2">
                    Amount to deposit
                  </label>
                  <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-4 py-3 mb-2">
                    <input
                      id="amount"
                      type="number"
                      step="0.00000001"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-transparent flex-1 outline-none text-lg font-mono"
                    />
                    <span className="text-zinc-500 font-mono text-sm">BTC</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmount(balanceBtc.toFixed(8))}
                    className="text-[#F7931A] text-sm hover:underline mb-2"
                  >
                    Use max
                  </button>
                  {overBalance && (
                    <p className="text-red-500 text-sm mb-2">
                      Amount exceeds your available balance.
                    </p>
                  )}

                  <p className="text-zinc-500 text-sm leading-relaxed mb-8 mt-6">
                    Your Bitcoin stays on Bitcoin L1 under your own keys. Earn {apy}% APY, paid
                    in Bitcoin.
                  </p>
                </>
              )}

              <button
                onClick={() => setStep('confirm')}
                disabled={numericAmount <= 0 || overBalance}
                className="w-full bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl text-lg hover:bg-[#e8841a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <p className="text-zinc-500 text-sm uppercase tracking-widest mb-6">
                Review Deposit
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">You deposit</span>
                  <span className="text-2xl font-bold">{numericAmount.toFixed(8)} BTC</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">Yield rate</span>
                  <span className="text-[#F7931A] font-semibold">{apy}% APY, paid in Bitcoin</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">Est. monthly earnings</span>
                  <span className="font-mono">~{monthlyEarnings.toFixed(8)} BTC</span>
                </div>
              </div>

              {/*
                Network fee is intentionally not shown here. submitDepositTx() signs a
                sponsored transaction — the project's sponsor account covers the STX fee
                server-side in /api/sponsor-tx, so the user never sees or pays one.
              */}
              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                Your Bitcoin stays on Bitcoin L1 under your own keys. You can withdraw anytime.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 border border-zinc-700 text-zinc-300 font-semibold px-6 py-4 rounded-xl hover:border-zinc-500 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
                >
                  Confirm Deposit
                </button>
              </div>
            </div>
          )}

          {step === 'pending' && (
            <PendingCard
              phase={phase}
              footer={`${numericAmount.toFixed(8)} BTC → earning ${apy}% APY`}
            />
          )}

          {step === 'success' && (
            <SuccessCard
              title="You're now earning"
              description={`${apy}% APY on ${satsToBtc(BigInt(depositedSats)).toFixed(8)} BTC, paid in Bitcoin.`}
              onDone={() => setStep('amount')}
            >
              <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8">
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                  Available Balance
                </p>
                <p className="text-3xl font-bold">{balanceBtc.toFixed(8)} BTC</p>
                <p className="text-zinc-500 text-sm mt-2">
                  <Link href="/dashboard" className="text-[#F7931A] hover:underline">
                    View your positions on the dashboard
                  </Link>
                </p>
              </div>
            </SuccessCard>
          )}

          {step === 'error' && (
            <ErrorCard
              title="We couldn't confirm your deposit"
              description={
                errorMessage ?? 'Something went wrong. Your sBTC has not moved. Please try again.'
              }
              onCancel={() => setStep('amount')}
              onRetry={() => setStep('confirm')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
