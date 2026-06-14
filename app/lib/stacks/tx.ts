import { JsonRpcErrorCode, request } from '@stacks/connect';
import { Cl, type ClarityValue } from '@stacks/transactions';
import { HIRO_API_URL, NETWORK_NAME, SBTC_TOKEN, YIELD_ROUTER, toContractId } from './network';

export type TxOutcome =
  | { status: 'success'; txid: string }
  | { status: 'failed'; reason: string }
  | { status: 'timeout' }
  | { status: 'cancelled' };

export type TxPhase = 'signing' | 'sponsoring' | 'confirming';

interface SubmitOptions {
  onPhase?: (phase: TxPhase) => void;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;

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

async function pollTxStatus(txid: string, timeoutMs: number): Promise<TxOutcome> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${HIRO_API_URL}/extended/v1/tx/${txid}`);
      if (res.ok) {
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
  { onPhase, timeoutMs = DEFAULT_TIMEOUT_MS }: SubmitOptions
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
      onPhase?.('confirming');
      return pollTxStatus(result.txid, timeoutMs);
    }
    throw new Error('Wallet did not return a signed transaction.');
  }

  onPhase?.('sponsoring');
  const txid = await sponsorAndBroadcast(result.transaction);

  onPhase?.('confirming');
  return pollTxStatus(txid, timeoutMs);
}

export async function submitDepositTx(amountSats: number, options: SubmitOptions = {}): Promise<TxOutcome> {
  if (!SBTC_TOKEN) {
    throw new Error('sBTC token contract is not configured (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS).');
  }

  return submitSponsoredContractCall(
    'deposit',
    [Cl.uint(amountSats), Cl.stringAscii('mock-yield'), Cl.principal(toContractId(SBTC_TOKEN))],
    options
  );
}

export async function submitWithdrawTx(positionId: number, options: SubmitOptions = {}): Promise<TxOutcome> {
  if (!SBTC_TOKEN) {
    throw new Error('sBTC token contract is not configured (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS).');
  }

  return submitSponsoredContractCall(
    'withdraw',
    [Cl.uint(positionId), Cl.principal(toContractId(SBTC_TOKEN))],
    options
  );
}
