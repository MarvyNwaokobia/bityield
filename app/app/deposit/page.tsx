'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { getSbtcBalanceSats } from '@/lib/stacks/balances';
import { getLiveApyPercent } from '@/lib/stacks/contract';
import { submitDepositTx, type TxPhase } from '@/lib/stacks/tx';
import { satsToBtc, SATS_PER_BTC, formatApyPercent } from '@/lib/stacks/format';
import { trackEvent } from '@/lib/track';
import { fadeSlideUp } from '@/lib/motion';
import { STRATEGY_OPTIONS } from '@/lib/strategies';
import { ConnectPrompt } from '../components/ConnectPrompt';
import { FlowShell } from '../components/app/FlowShell';
import { Keypad, applyAmountKey } from '../components/app/Keypad';
import { Chip, Skeleton, SummaryRow } from '../components/app/ui';
import { ErrorCard, PendingCard, SuccessCard } from '../components/TransactionStatus';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PrimaryButton } from '../components/Button';
import { StrategyName, SBTC_ACQUIRE_URL, NETWORK_NAME, explorerContractUrl, explorerTxUrl, strategyContractId, YIELD_ROUTER, toContractId } from '@/lib/stacks/network';

type Step = 'amount' | 'confirm' | 'pending' | 'success' | 'error';


// Where a user can read about the underlying protocol itself, not just
// BitYield's summary of it.
const PROTOCOL_LINKS: Partial<Record<StrategyName, string>> = {
  zest: 'https://www.zestprotocol.com/',
  'dual-stacking': 'https://docs.stacks.co/dual-stacking',
};

// Below this, Zest's live rate reads as "0.0%" (rounding), which looks broken
// rather than honest. Zest's sBTC reserve currently has borrowing disabled /
// near-zero utilization, so the true supply APY really is close to zero —
// this note is what makes that legible instead of looking like a bug.
const ZEST_NEAR_ZERO_NOTE =
  'Zest’s sBTC reserve currently has very low borrowing demand, so the real supply rate is near zero. This is the true live rate, not a display error — it moves with Zest’s own market conditions.';

function DepositInner() {
  const { address, isConnected } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('strategy');

  const [step, setStep] = useState<Step>('amount');
  const [balanceSats, setBalanceSats] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [amount, setAmount] = useState('0');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyName>(
    STRATEGY_OPTIONS.some((o) => o.id === requested && o.status === 'live')
      ? (requested as StrategyName)
      : 'dual-stacking'
  );
  const [phase, setPhase] = useState<TxPhase>('signing');
  const [txid, setTxid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depositedSats, setDepositedSats] = useState(0);
  const [liveApyPercent, setLiveApyPercent] = useState<Partial<Record<StrategyName, number>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [zest, dualStacking] = await Promise.all([
        getLiveApyPercent('zest'),
        getLiveApyPercent('dual-stacking'),
      ]);
      if (cancelled) return;
      setLiveApyPercent((prev) => ({
        ...prev,
        ...(zest !== null ? { zest } : {}),
        ...(dualStacking !== null ? { 'dual-stacking': dualStacking } : {}),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setBalanceError(false);
    try {
      const sats = await getSbtcBalanceSats(address);
      setBalanceSats(sats);
    } catch {
      // A failed read must never look like an empty wallet, so surface a retry.
      setBalanceSats(null);
      setBalanceError(true);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) {
      refreshBalance();
    }
  }, [isConnected, refreshBalance]);

  const selectedStrategyOption = STRATEGY_OPTIONS.find((s) => s.id === selectedStrategy)!;
  const apy = liveApyPercent[selectedStrategy] ?? selectedStrategyOption.apy;
  const apyIsLive = liveApyPercent[selectedStrategy] !== undefined;

  const balanceBtc = balanceSats !== null ? satsToBtc(balanceSats) : 0;
  const numericAmount = Math.min(Math.max(Number(amount) || 0, 0), balanceBtc);
  const overBalance = Number(amount) > balanceBtc;
  const monthlyEarnings = (numericAmount * (apy / 100)) / 12;
  const amountSats = Math.round(numericAmount * SATS_PER_BTC);

  const handleConfirm = async () => {
    setStep('pending');
    setErrorMessage(null);
    setPhase('signing');
    setTxid(null);
    trackEvent('deposit_attempted', { wallet: address ?? undefined, strategy: selectedStrategy, amountSats });
    let lastTxid: string | undefined;
    try {
      const outcome = await submitDepositTx(amountSats, selectedStrategy, {
        onPhase: setPhase,
        onTxId: (id) => {
          lastTxid = id;
          setTxid(id);
        },
      });
      if (outcome.status === 'success') {
        setDepositedSats(amountSats);
        setAmount('0');
        await refreshBalance();
        setStep('success');
        trackEvent('deposit_completed', {
          wallet: address ?? undefined,
          strategy: selectedStrategy,
          amountSats,
          txid: outcome.txid,
        });
      } else if (outcome.status === 'cancelled') {
        setStep('confirm');
      } else if (outcome.status === 'timeout') {
        trackEvent('deposit_failed', { wallet: address ?? undefined, strategy: selectedStrategy, amountSats, reason: 'timeout', txid: lastTxid });
        setErrorMessage(
          'This is taking longer than expected. Your transaction may still confirm. Check your dashboard in a few minutes.'
        );
        setStep('error');
      } else {
        trackEvent('deposit_failed', { wallet: address ?? undefined, strategy: selectedStrategy, amountSats, reason: 'failed', txid: lastTxid });
        setErrorMessage(
          'This sometimes happens when network conditions change. Your balance is unaffected.'
        );
        setStep('error');
      }
    } catch (err) {
      trackEvent('deposit_failed', { wallet: address ?? undefined, strategy: selectedStrategy, amountSats, reason: 'error', txid: lastTxid });
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  };


  const pressKey = useCallback((k: string) => setAmount((prev) => applyAmountKey(prev, k)), []);
  const setFraction = (f: number) => {
    if (balanceSats === null) return;
    const sats = f >= 1 ? balanceSats : BigInt(Math.floor(Number(balanceSats) * f));
    setAmount(sats > 0n ? satsToBtc(sats).toFixed(8).replace(/\.?0+$/, '') : '0');
  };
  const zestNearZero = liveApyPercent[selectedStrategy] !== undefined && liveApyPercent[selectedStrategy]! < 0.01;
  const hasBalance = balanceSats !== null && balanceSats > 0n;
  const onAmountStep = isConnected && step === 'amount' && hasBalance;
  const canContinue = numericAmount > 0 && !overBalance && !selectedStrategyOption.disabled;

  const shellTitle =
    step === 'confirm' ? 'Review deposit' : step === 'pending' ? 'Depositing' : step === 'success' ? 'Done' : step === 'error' ? 'Deposit failed' : 'Deposit';

  const footer =
    onAmountStep ? (
      <PrimaryButton onClick={() => setStep('confirm')} disabled={!canContinue} className="w-full px-6 py-4 text-base">
        Continue
      </PrimaryButton>
    ) : step === 'confirm' ? (
      <PrimaryButton onClick={handleConfirm} className="w-full px-6 py-4 text-base">
        Confirm deposit
      </PrimaryButton>
    ) : undefined;

  return (
    <FlowShell
      title={shellTitle}
      step={step === 'amount' && hasBalance ? 1 : step === 'confirm' ? 2 : undefined}
      total={step === 'amount' && hasBalance ? 2 : step === 'confirm' ? 2 : undefined}
      onBack={step === 'confirm' ? () => setStep('amount') : undefined}
      close={step === 'success' || step === 'error'}
      footer={footer}
    >
      <AnimatePresence mode="wait">
        {!isConnected && step === 'amount' && (
          <motion.div key="connect" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="my-auto">
            <ConnectPrompt description="Connect your Stacks wallet to see your sBTC balance and start earning." />
          </motion.div>
        )}

        {isConnected && step === 'amount' && balanceSats === null && !balanceError && (
          <motion.div key="loading" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="space-y-6 pt-10">
            <Skeleton className="mx-auto h-14 w-56" />
            <Skeleton className="mx-auto h-4 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-56 w-full" />
          </motion.div>
        )}

        {isConnected && step === 'amount' && balanceError && (
          <motion.div key="balance-error" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="my-auto space-y-4 text-center">
            <div className="mx-auto w-fit rounded-full bg-amber-500/10 p-3 text-amber-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-zinc-400">
              We couldn&apos;t load your balance just now. This is a network hiccup, not a problem with your wallet. Your
              sBTC is safe.
            </p>
            <PrimaryButton onClick={refreshBalance} className="px-8 py-3 text-sm">
              Retry
            </PrimaryButton>
          </motion.div>
        )}

        {isConnected && step === 'amount' && balanceSats !== null && balanceSats === 0n && (
          <motion.div key="empty" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="my-auto space-y-5 text-center">
            <div className="mx-auto w-fit rounded-full bg-bitcoin/10 p-4 text-bitcoin">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <p className="font-display text-xl font-semibold">No sBTC in this wallet yet</p>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-400">
              sBTC is 1:1 Bitcoin-backed. Get some via the{' '}
              {NETWORK_NAME === 'mainnet'
                ? 'official sBTC bridge (send BTC, receive sBTC at this wallet, usually about 20 to 40 minutes)'
                : 'Hiro testnet faucet'}
              , then come back and refresh.
            </p>
            <a href={SBTC_ACQUIRE_URL} target="_blank" rel="noopener noreferrer" className="block">
              <PrimaryButton className="w-full px-6 py-4 text-base">
                {NETWORK_NAME === 'mainnet' ? 'Open sBTC bridge ↗' : 'Open testnet faucet ↗'}
              </PrimaryButton>
            </a>
            <button onClick={refreshBalance} className="cursor-pointer text-sm text-zinc-400 transition-colors hover:text-white">
              I&apos;ve got sBTC, refresh balance
            </button>
          </motion.div>
        )}

        {onAmountStep && (
          <motion.div key="amount" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            {/* Amount display */}
            <div className="pt-4 text-center">
              <p
                className={`font-display font-bold tabular-nums tracking-tight ${
                  amount.length > 11 ? 'text-3xl' : amount.length > 8 ? 'text-4xl' : 'text-5xl'
                } ${overBalance ? 'text-red-400' : amount === '0' ? 'text-zinc-600' : 'text-white'}`}
              >
                {amount}
                <span className="ml-2 text-lg font-semibold text-zinc-500">BTC</span>
              </p>
              <p className={`mt-2 text-sm ${overBalance ? 'text-red-400' : 'text-zinc-500'}`}>
                {overBalance ? 'Amount exceeds your available balance' : `Available ${balanceBtc.toFixed(8)} BTC`}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {[0.25, 0.5, 0.75, 1].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFraction(f)}
                    className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-bitcoin/50 hover:text-bitcoin"
                  >
                    {f === 1 ? 'Max' : `${f * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Route picker */}
            <div className="mt-6">
              <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Yield route">
                {STRATEGY_OPTIONS.map((opt) => {
                  const selected = selectedStrategy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={opt.disabled}
                      onClick={() => setSelectedStrategy(opt.id)}
                      className={`min-w-[9.5rem] flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                        selected ? 'border-bitcoin bg-bitcoin/5' : 'border-line bg-surface hover:border-zinc-600'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{opt.name}</span>
                        {opt.status !== 'live' && <Chip tone="gray">Preview</Chip>}
                      </span>
                      <span className="mt-0.5 block text-xs text-bitcoin">
                        {formatApyPercent(liveApyPercent[opt.id] ?? opt.apy)} APY
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-xs text-zinc-500">
                {numericAmount > 0 ? (
                  <>
                    Earn about{' '}
                    <span className="font-mono text-zinc-300">{monthlyEarnings.toFixed(8)} BTC</span> per month
                  </>
                ) : (
                  <>Paid in Bitcoin, {apyIsLive ? 'live rate' : 'current rate'}</>
                )}
              </p>
              {zestNearZero && <p className="mt-2 text-center text-[11px] leading-snug text-amber-400/90">{ZEST_NEAR_ZERO_NOTE}</p>}
            </div>

            <div className="mt-auto pt-4">
              <Keypad onKey={pressKey} active={onAmountStep} />
            </div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div key="confirm" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="space-y-5">
            <div className="pt-2 text-center">
              <p className="text-sm text-zinc-500">You deposit</p>
              <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight">
                <AnimatedNumber value={numericAmount} formatter={(n) => n.toFixed(8)} />
                <span className="ml-2 text-lg font-semibold text-zinc-500">BTC</span>
              </p>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              <SummaryRow label="Route">{selectedStrategyOption.name}</SummaryRow>
              <SummaryRow label="Rate">
                <span className="text-bitcoin">
                  {formatApyPercent(apy)} APY{apyIsLive ? ' (live)' : ''}
                </span>
              </SummaryRow>
              <SummaryRow label="Est. monthly earnings">
                <span className="font-mono">~{monthlyEarnings.toFixed(8)} BTC</span>
              </SummaryRow>
              <SummaryRow label="Network fee">
                <span className="text-emerald-400">Free (sponsored)</span>
              </SummaryRow>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-xs text-zinc-400">
              <div className="mt-0.5 rounded-md bg-bitcoin/10 p-1 text-bitcoin">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white">Zero gas fees</p>
                <p className="mt-0.5 leading-relaxed">
                  This transaction is fully sponsored. You do not need to hold or spend STX to pay for Stacks network
                  transaction fees.
                </p>
                <p className="mt-1.5 leading-relaxed text-zinc-500">
                  Sponsorship is part of early access and won&rsquo;t run forever, so at some point network fees become
                  yours to cover. Even then you won&rsquo;t need to hold STX, just a small fee settled in sBTC or taken
                  from the yield you&rsquo;ve already earned.
                </p>
              </div>
            </div>

            {/* Risk & disclosures: honest statement of what this deposit does today */}
            <details open className="group rounded-2xl border border-amber-500/20 bg-surface p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  Risk &amp; disclosures
                </span>
                <span className="text-xs font-normal text-zinc-500 group-open:hidden">Show</span>
                <span className="hidden text-xs font-normal text-zinc-500 group-open:inline">Hide</span>
              </summary>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-zinc-400">
                <li>
                  <span className="font-medium text-zinc-300">
                    {selectedStrategyOption.status === 'live' ? 'Live route.' : selectedStrategyOption.status === 'deployed' ? 'Deployed, untested route.' : 'Preview strategy.'}
                  </span>{' '}
                  {selectedStrategyOption.riskNote}
                </li>
                <li>
                  <span className="font-medium text-zinc-300">Custody.</span> Your sBTC is transferred to the strategy
                  contract and recorded to your address. Only you can withdraw your position, principal plus accrued yield.
                </li>
                <li>
                  <span className="font-medium text-zinc-300">Smart-contract risk.</span> These contracts are running on
                  {NETWORK_NAME === 'mainnet' ? ' mainnet' : ' Stacks testnet'} and are not yet independently audited. Deposit only what you are comfortable testing with.
                </li>
                <li>
                  <span className="font-medium text-zinc-300">Admin key risk.</span> One owner key controls these
                  contracts and has emergency functions that can move the funds they hold. Ownership moves to a
                  multisig before any public launch.
                </li>
                <li>
                  <span className="font-medium text-zinc-300">sBTC peg risk.</span> sBTC is backed 1:1 by BTC held by the sBTC
                  signers. BitYield runs no bridge of its own, but the peg depends on those signers and the official bridge.
                </li>
              </ul>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3">
                {strategyContractId(selectedStrategy) && (
                  <a href={explorerContractUrl(strategyContractId(selectedStrategy)!)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-bitcoin/80 hover:text-bitcoin hover:underline">
                    Verify strategy contract ↗
                  </a>
                )}
                {YIELD_ROUTER && (
                  <a href={explorerContractUrl(toContractId(YIELD_ROUTER))} target="_blank" rel="noopener noreferrer" className="text-[11px] text-bitcoin/80 hover:text-bitcoin hover:underline">
                    Verify router contract ↗
                  </a>
                )}
                {PROTOCOL_LINKS[selectedStrategy] && (
                  <a href={PROTOCOL_LINKS[selectedStrategy]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-zinc-500 hover:text-zinc-300 hover:underline">
                    About {selectedStrategyOption.targetProtocol} ↗
                  </a>
                )}
              </div>
            </details>
          </motion.div>
        )}

        {step === 'pending' && (
          <motion.div key="pending" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            <PendingCard
              phase={phase}
              explorerUrl={txid ? explorerTxUrl(txid) : undefined}
              footer={`${numericAmount.toFixed(8)} BTC → ${formatApyPercent(apy)} APY on ${selectedStrategyOption.name}`}
            />
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            <SuccessCard
              title="You're now earning"
              description={`${formatApyPercent(apy)} APY on ${satsToBtc(BigInt(depositedSats)).toFixed(8)} BTC with ${selectedStrategyOption.name}, paid in Bitcoin.`}
              onDone={() => router.push('/dashboard')}
              doneLabel="Back to Home"
              explorerUrl={txid ? explorerTxUrl(txid) : undefined}
            >
              <div className="mb-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-left">
                <SummaryRow label="Deposited">
                  <span className="font-mono">{satsToBtc(BigInt(depositedSats)).toFixed(8)} BTC</span>
                </SummaryRow>
                <SummaryRow label="Route">{selectedStrategyOption.name}</SummaryRow>
                <SummaryRow label="Still in wallet">
                  <span className="font-mono">{balanceBtc.toFixed(8)} BTC</span>
                </SummaryRow>
              </div>
              {process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL && (
                <p className="mb-2 text-center text-sm text-zinc-500">
                  <a href={process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="text-bitcoin/90 hover:text-bitcoin hover:underline">
                    Got 2 minutes? Tell us how this felt →
                  </a>
                </p>
              )}
            </SuccessCard>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial="initial" animate="animate" exit="exit" variants={fadeSlideUp} className="flex flex-1 flex-col">
            <ErrorCard
              title="We couldn't confirm your deposit"
              description={errorMessage ?? 'Something went wrong. Your sBTC has not moved. Please try again.'}
              onCancel={() => setStep('amount')}
              onRetry={() => setStep('confirm')}
              explorerUrl={txid ? explorerTxUrl(txid) : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </FlowShell>
  );
}

export default function DepositPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0a0a0a]" />}>
      <DepositInner />
    </Suspense>
  );
}
