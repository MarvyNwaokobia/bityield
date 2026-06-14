'use client';

import { useState } from 'react';
import Link from 'next/link';

// Mock data — replace with live wallet balance and live yield rate once
// the Leather Wallet / Hiro API integration lands.
const MOCK_BTC_BALANCE = 0.0524;
const YIELD_RATE_APY = 5;

const TIMEOUT_MS = 60000;

// TODO(fee-abstraction): Before broadcasting the real deposit transaction, this is
// where the project must make the required STX network fee invisible to the user —
// either (Option A) cover it from a project-controlled reserve and account for the
// cost on the backend, or (Option B) auto-swap a small portion of the user's
// BTC/sBTC for the STX needed to pay the fee as part of this same transaction.
// The confirmation screen must never show STX, a separate fee line, or a second
// balance — only the user's BTC amount and yield rate.
async function submitDeposit(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true }), 4000);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

type Step = 'amount' | 'confirm' | 'pending' | 'success' | 'error';

export default function DepositPage() {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(MOCK_BTC_BALANCE.toFixed(8));

  const numericAmount = Math.min(Math.max(Number(amount) || 0, 0), MOCK_BTC_BALANCE);
  const overBalance = Number(amount) > MOCK_BTC_BALANCE;
  const monthlyEarnings = (numericAmount * (YIELD_RATE_APY / 100)) / 12;

  const handleConfirm = async () => {
    setStep('pending');
    try {
      const result = await withTimeout(submitDeposit(), TIMEOUT_MS);
      setStep(result.success ? 'success' : 'error');
    } catch {
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
          {step === 'amount' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                Your Balance
              </p>
              <p className="text-4xl font-bold mb-1">{MOCK_BTC_BALANCE.toFixed(8)} BTC</p>
              <p className="text-zinc-500 text-sm mb-8">Currently earning 0%</p>

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
                onClick={() => setAmount(MOCK_BTC_BALANCE.toFixed(8))}
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
                Your Bitcoin stays on Bitcoin L1 under your own keys. Earn{' '}
                {YIELD_RATE_APY}% APY, paid in Bitcoin.
              </p>

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
                  <span className="text-[#F7931A] font-semibold">
                    {YIELD_RATE_APY}% APY, paid in Bitcoin
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-zinc-400">Est. monthly earnings</span>
                  <span className="font-mono">~{monthlyEarnings.toFixed(8)} BTC</span>
                </div>
              </div>

              {/*
                Network fee is intentionally not shown here. See the TODO on
                submitDeposit() above — fee coverage / auto-swap must happen
                invisibly before this transaction is broadcast.
              */}
              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                Your Bitcoin stays on Bitcoin L1 under your own keys. You can withdraw
                anytime.
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
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 border-4 border-zinc-700 border-t-[#F7931A] rounded-full animate-spin" />
              </div>
              <p className="text-xl font-semibold mb-2">Confirming your deposit</p>
              <p className="text-zinc-400 mb-6">This usually takes about a minute.</p>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-[#F7931A] animate-pulse" />
              </div>
              <p className="text-zinc-600 text-sm mt-6">
                {numericAmount.toFixed(8)} BTC → earning {YIELD_RATE_APY}% APY
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-full bg-[#F7931A]/10 border border-[#F7931A] flex items-center justify-center text-2xl text-[#F7931A]">
                  ✓
                </div>
              </div>
              <p className="text-xl font-semibold mb-2">You&apos;re now earning</p>
              <p className="text-zinc-400 mb-8">
                {YIELD_RATE_APY}% APY on {numericAmount.toFixed(8)} BTC, paid in Bitcoin.
              </p>

              <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8">
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                  New Balance
                </p>
                <p className="text-3xl font-bold">{MOCK_BTC_BALANCE.toFixed(8)} BTC</p>
                <p className="text-zinc-500 text-sm mt-2">
                  {numericAmount.toFixed(8)} BTC earning ·{' '}
                  {(MOCK_BTC_BALANCE - numericAmount).toFixed(8)} BTC available
                </p>
              </div>

              <button
                onClick={() => setStep('amount')}
                className="w-full bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center text-2xl text-red-500">
                  !
                </div>
              </div>
              <p className="text-xl font-semibold mb-2">
                We couldn&apos;t confirm your deposit
              </p>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                This sometimes happens when network conditions change. Your Bitcoin has
                not moved and your balance is unaffected. Please try again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 border border-zinc-700 text-zinc-300 font-semibold px-6 py-4 rounded-xl hover:border-zinc-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl hover:bg-[#e8841a] transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
