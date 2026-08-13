import { JsonRpcErrorCode, request } from '@stacks/connect';
// Import the CV factory functions directly rather than via the `Cl` namespace
// object: production tree-shaking strips the namespace's methods (`Cl.uint is
// not a function`), but directly-referenced named exports survive.
import { uintCV, stringAsciiCV, principalCV, bufferCV, someCV, noneCV, type ClarityValue } from '@stacks/transactions';
import { HIRO_API_URL, NETWORK_NAME, SBTC_TOKEN, YIELD_ROUTER, STRATEGIES, type StrategyName, toContractId } from './network';
import { fetchPythPriceFeedBytes } from './pyth';

// Routes that supply into an oracle-priced protocol (Zest) must carry a fresh
// Pyth price update on withdraw. Others (dual-stacking rewards, preview) pass
// `none`.
const STRATEGIES_NEEDING_PRICE_FEED: ReadonlySet<StrategyName> = new Set<StrategyName>(['zest']);

export type TxOutcome =
  | { status: 'success'; txid: string }
  | { status: 'failed'; reason: string }
  | { status: 'timeout' }
  | { status: 'cancelled' };

export type TxPhase = 'signing' | 'sponsoring' | 'confirming';

interface SubmitOptions {
  onPhase?: (phase: TxPhase) => void;
  // Fires once Hiro's own indexer has actually picked up the transaction (its
  // API returns something other than 404 for this txid) — not the instant we
  // have a bare txid string. Immediately after broadcast, Hiro's API has no
  // record of the tx yet ("could not find transaction by ID"), and its
  // explorer website renders that same not-found state as a "Failed" badge
  // rather than "Pending". Waiting for the first real lookup before handing
  // the user a link means the explorer page they land on already knows the
  // tx exists (at minimum "pending"), instead of showing a false Failed.
  onTxId?: (txid: string) => void;
  timeoutMs?: number;
}

// Nakamoto blocks land roughly every 10–25s; with mempool + API indexing a
// confirmation is usually visible in 30–60s. Give it 90s before timing out.
const DEFAULT_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2_500;

async function sponsorAndBroadcast(serializedTx: string): Promise<string> {
  const res = await fetch('/api/sponsor-tx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serializedTx }),
  });
  const data: { txid?: string; error?: string } = await res.json();
  if (!res.ok || !data.txid) {
    throw new Error(data.error ?? 'Failed to submit transaction.');
  }
  return data.txid;
}

async function pollTxStatus(txid: string, timeoutMs: number, onSeen?: () => void): Promise<TxOutcome> {
  const deadline = Date.now() + timeoutMs;
  let seen = false;

  while (Date.now() < deadline) {
    try {
      // Poll the canonical (anchored) status so we only report success once the
      // transaction is genuinely confirmed — i.e. the app's "done" matches what
      // the explorer shows, and we never claim "earning" before it's final.
      const res = await fetch(`${HIRO_API_URL}/extended/v1/tx/${txid}`);
      if (res.ok) {
        // First response where Hiro's API actually knows about this txid
        // (vs. a 404 "could not find transaction by ID"). Safe to surface an
        // explorer link now.
        if (!seen) {
          seen = true;
          onSeen?.();
        }
        const data: { tx_status?: string } = await res.json();
        if (data.tx_status === 'success') return { status: 'success', txid };
        if (data.tx_status && data.tx_status.startsWith('abort_')) {
          return { status: 'failed', reason: data.tx_status };
        }
      }
    } catch {
      // Network hiccup — keep polling until the timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { status: 'timeout' };
}

/**
 * Signs a `yield-router` contract call with the connected wallet using a
 * sponsored transaction (the user never pays or sees an STX fee), hands the
 * signed-but-unsponsored transaction to /api/sponsor-tx to pay the fee and
 * broadcast, then polls for confirmation.
 */
async function submitSponsoredContractCall(
  functionName: 'deposit' | 'withdraw',
  functionArgs: ClarityValue[],
  { onPhase, onTxId, timeoutMs = DEFAULT_TIMEOUT_MS }: SubmitOptions
): Promise<TxOutcome> {
  if (!YIELD_ROUTER) {
    throw new Error('YieldRouter contract is not configured (NEXT_PUBLIC_YIELD_ROUTER_ADDRESS).');
  }

  onPhase?.('signing');
  let result;
  try {
    result = await request('stx_callContract', {
      contract: toContractId(YIELD_ROUTER),
      functionName,
      functionArgs,
      network: NETWORK_NAME,
      sponsored: true,
      // deposit/withdraw move sBTC via ft-transfer? without declaring matching
      // post-conditions, so Deny mode (the default) would abort the tx.
      postConditionMode: 'allow',
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === JsonRpcErrorCode.UserRejection || code === JsonRpcErrorCode.UserCanceled) {
      return { status: 'cancelled' };
    }
    throw err;
  }

  if (!result.transaction) {
    if (result.txid) {
      const walletTxid = result.txid;
      onPhase?.('confirming');
      return pollTxStatus(walletTxid, timeoutMs, () => onTxId?.(walletTxid));
    }
    throw new Error('Wallet did not return a signed transaction.');
  }

  onPhase?.('sponsoring');
  const txid = await sponsorAndBroadcast(result.transaction);

  onPhase?.('confirming');
  return pollTxStatus(txid, timeoutMs, () => onTxId?.(txid));
}

export async function submitDepositTx(
  amountSats: number,
  strategyName: StrategyName,
  options: SubmitOptions = {}
): Promise<TxOutcome> {
  if (!SBTC_TOKEN) {
    throw new Error('sBTC token contract is not configured (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS).');
  }
  const strategy = STRATEGIES[strategyName];
  if (!strategy) {
    throw new Error(`Strategy contract for ${strategyName} is not configured.`);
  }

  return submitSponsoredContractCall(
    'deposit',
    [
      uintCV(amountSats),
      stringAsciiCV(strategyName),
      principalCV(toContractId(strategy)),
      principalCV(toContractId(SBTC_TOKEN)),
    ],
    options
  );
}

export async function submitWithdrawTx(
  positionId: number,
  strategyName: StrategyName,
  options: SubmitOptions = {}
): Promise<TxOutcome> {
  if (!SBTC_TOKEN) {
    throw new Error('sBTC token contract is not configured (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS).');
  }
  const strategy = STRATEGIES[strategyName];
  if (!strategy) {
    throw new Error(`Strategy contract for ${strategyName} is not configured.`);
  }

  // Oracle-priced routes (Zest) need a fresh Pyth update in the same tx, or the
  // protocol reverts. Fetch it right before submitting so it is not stale.
  let priceFeed: ClarityValue = noneCV();
  if (STRATEGIES_NEEDING_PRICE_FEED.has(strategyName)) {
    const bytes = await fetchPythPriceFeedBytes();
    priceFeed = someCV(bufferCV(bytes));
  }

  return submitSponsoredContractCall(
    'withdraw',
    [
      uintCV(positionId),
      principalCV(toContractId(strategy)),
      principalCV(toContractId(SBTC_TOKEN)),
      priceFeed,
    ],
    options
  );
}
