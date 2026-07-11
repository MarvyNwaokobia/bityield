'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { getSbtcBalanceSats } from '@/lib/stacks/balances';
import { submitDepositTx, type TxPhase } from '@/lib/stacks/tx';
import { satsToBtc, SATS_PER_BTC } from '@/lib/stacks/format';
import { fadeSlideUp, staggerContainer } from '@/lib/motion';
import { Logo } from '../components/Logo';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { ErrorCard, PendingCard, SuccessCard } from '../components/TransactionStatus';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { StrategyName, SBTC_ACQUIRE_URL, NETWORK_NAME } from '@/lib/stacks/network';

type Step = 'amount' | 'confirm' | 'pending' | 'success' | 'error';

interface StrategyOption {
  id: StrategyName;
  name: string;
  apy: number;
  provider: string;
  risk: 'Low' | 'Medium';
  desc: string;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  { id: 'zest', name: 'Zest Lending', apy: 4.5, provider: 'Zest Protocol', risk: 'Low', desc: 'Lend your sBTC to audited institutional borrowers for native yield.' },
  { id: 'hermetica', name: 'Hermetica Structured', apy: 6.2, provider: 'Hermetica Options', risk: 'Medium', desc: 'Earn options premium from an automated, delta-neutral strategy.' },
  { id: 'dual-stacking', name: 'Dual Stacking', apy: 8.5, provider: 'Stacks Staking', risk: 'Low', desc: 'Secure the Stacks network through PoX Stacking to receive BTC yield.' }
];

export default function DepositPage() {
  const { address, isConnected } = useWallet();

  const [step, setStep] = useState<Step>('amount');
  const [balanceSats, setBalanceSats] = useState<bigint | null>(null);
  const [amount, setAmount] = useState('0');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyName>('zest');
  const [phase, setPhase] = useState<TxPhase>('signing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depositedSats, setDepositedSats] = useState(0);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    const sats = await getSbtcBalanceSats(address);
    setBalanceSats(sats);
    if (sats > 0n) {
      setAmount(satsToBtc(sats).toFixed(8));
    } else {
      setAmount('0');
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) {
      refreshBalance();
    }
  }, [isConnected, refreshBalance]);

  const selectedStrategyOption = STRATEGY_OPTIONS.find((s) => s.id === selectedStrategy)!;
  const apy = selectedStrategyOption.apy;

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
      const outcome = await submitDepositTx(amountSats, selectedStrategy, { onPhase: setPhase });
      if (outcome.status === 'success') {
        setDepositedSats(amountSats);
        await refreshBalance();
        setStep('success');
      } else if (outcome.status === 'cancelled') {
        setStep('confirm');
      } else if (outcome.status === 'timeout') {
        setErrorMessage(
          'This is taking longer than expected. Your transaction may still confirm — check your dashboard in a few minutes.'
        );
        setStep('error');
      } else {
        setErrorMessage(
          'This sometimes happens when network conditions change. Your balance is unaffected.'
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
        <Logo />
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Back to Dashboard
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {!isConnected && step === 'amount' && (
              <motion.div key="connect" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <ConnectPrompt description="Connect your Stacks wallet to see your sBTC balance and start earning." />
              </motion.div>
            )}

            {isConnected && step === 'amount' && balanceSats === null && (
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
                <p className="text-zinc-400">Loading your balance…</p>
              </motion.div>
            )}

            {isConnected && step === 'amount' && balanceSats !== null && (
              <motion.div
                key="amount"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeSlideUp}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6"
              >
                <div>
                  <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                    Available Balance
                  </p>
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-4xl font-bold">
                      <AnimatedNumber value={balanceBtc} formatter={(n) => n.toFixed(8)} /> BTC
                    </p>
                    <a
                      href={SBTC_ACQUIRE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bitcoin border border-bitcoin/20 hover:bg-bitcoin/10 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Get sBTC ↗
                    </a>
                  </div>
                </div>

                {balanceSats === 0n ? (
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-6 text-center space-y-4">
                    <div className="text-bitcoin w-fit p-3 rounded-full bg-bitcoin/10 mx-auto">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      You don&apos;t have any sBTC in this wallet yet. sBTC is 1:1 Bitcoin-backed —
                      get some via the {NETWORK_NAME === 'mainnet' ? 'official sBTC bridge' : 'Hiro testnet faucet'},
                      then come back and refresh.
                    </p>
                    <a
                      href={SBTC_ACQUIRE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <PrimaryButton className="px-6 py-2.5 text-sm w-full">
                        {NETWORK_NAME === 'mainnet' ? 'Open sBTC Bridge ↗' : 'Open Testnet Faucet ↗'}
                      </PrimaryButton>
                    </a>
                    <button
                      onClick={refreshBalance}
                      className="text-zinc-400 hover:text-white text-sm cursor-pointer transition-colors"
                    >
                      I&apos;ve got sBTC — refresh balance
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="amount" className="block text-sm text-zinc-400">
                        Amount to deposit
                      </label>
                      <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-4 py-3.5 transition-all duration-200 focus-within:border-bitcoin focus-within:shadow-[0_0_0_3px_rgba(247,147,26,0.15)]">
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
                        className="text-bitcoin text-sm hover:underline cursor-pointer"
                      >
                        Use max
                      </button>
                      {overBalance && (
                        <p className="text-red-500 text-sm mt-1">
                          Amount exceeds your available balance.
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm text-zinc-400">
                        Select Yield Strategy
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        {STRATEGY_OPTIONS.map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => setSelectedStrategy(opt.id)}
                            className={`glow-card border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                              selectedStrategy === opt.id
                                ? 'bg-bitcoin/5 border-bitcoin shadow-[0_0_15px_rgba(247,147,26,0.08)]'
                                : 'bg-black border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="space-y-1 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{opt.name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  opt.risk === 'Low' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {opt.risk} Risk
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 leading-snug">{opt.desc}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-display text-lg font-bold text-bitcoin whitespace-nowrap">{opt.apy}% APY</span>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{opt.provider}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Educational Trust Anchor (Inline FAQ Tooltip) */}
                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-bitcoin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                        </svg>
                        Your Bitcoin stays on Bitcoin L1
                      </p>
                      <p className="leading-relaxed">
                        Through Stacks sBTC, your assets are secured by Bitcoin L1 consensus. You maintain self-custody under your own keys, with no third-party wrapping or bridge risk.
                      </p>
                    </div>

                    <PrimaryButton
                      onClick={() => setStep('confirm')}
                      disabled={numericAmount <= 0 || overBalance}
                      className="w-full px-6 py-4 text-lg"
                    >
                      Continue
                    </PrimaryButton>
                  </>
                )}
              </motion.div>
            )}


            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fadeSlideUp}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
              >
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-6">
                  Review Deposit
                </p>

                <motion.div
                  initial="initial"
                  animate="animate"
                  variants={staggerContainer}
                  className="space-y-4 mb-8"
                >
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">You deposit</span>
                    <span className="font-display text-2xl font-bold">
                      <AnimatedNumber value={numericAmount} formatter={(n) => n.toFixed(8)} /> BTC
                    </span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">Yield strategy</span>
                    <span className="font-semibold">{selectedStrategyOption.name}</span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">Yield rate</span>
                    <span className="text-bitcoin font-semibold">{apy}% APY, paid in Bitcoin</span>
                  </motion.div>
                  <motion.div variants={fadeSlideUp} className="flex justify-between items-baseline">
                    <span className="text-zinc-400">Est. monthly earnings</span>
                    <span className="font-mono">
                      ~<AnimatedNumber value={monthlyEarnings} formatter={(n) => n.toFixed(8)} /> BTC
                    </span>
                  </motion.div>
                </motion.div>

                {/* Educational Trust Anchor for Sponsored gas */}
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-400 flex items-start gap-3 mb-8">
                  <div className="text-bitcoin p-1 bg-bitcoin/10 rounded-md mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Zero Gas Fees</p>
                    <p className="leading-relaxed mt-0.5">
                      This transaction is fully sponsored. You do not need to hold or spend STX to pay for Stacks network transaction fees.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <SecondaryButton onClick={() => setStep('amount')} className="flex-1 px-6 py-4">
                    Back
                  </SecondaryButton>
                  <PrimaryButton onClick={handleConfirm} className="flex-1 px-6 py-4">
                    Confirm Deposit
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 'pending' && (
              <motion.div key="pending" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <PendingCard
                  phase={phase}
                  footer={`${numericAmount.toFixed(8)} BTC → earning ${apy}% APY on ${selectedStrategyOption.name}`}
                />
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <SuccessCard
                  title="You're now earning"
                  description={`${apy}% APY on ${satsToBtc(BigInt(depositedSats)).toFixed(8)} BTC with ${selectedStrategyOption.name}, paid in Bitcoin.`}
                  onDone={() => setStep('amount')}
                >
                  <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8 text-center sm:text-left">
                    <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">
                      Available Balance
                    </p>
                    <p className="font-display text-3xl font-bold">
                      <AnimatedNumber value={balanceBtc} formatter={(n) => n.toFixed(8)} /> BTC
                    </p>
                    <p className="text-zinc-500 text-sm mt-3">
                      <Link href="/dashboard" className="text-bitcoin hover:underline font-semibold">
                        View positions on your dashboard →
                      </Link>
                    </p>
                  </div>
                </SuccessCard>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div key="error" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp}>
                <ErrorCard
                  title="We couldn't confirm your deposit"
                  description={
                    errorMessage ?? 'Something went wrong. Your sBTC has not moved. Please try again.'
                  }
                  onCancel={() => setStep('amount')}
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
