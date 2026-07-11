import { HIRO_API_URL, YIELD_ROUTER, toContractId } from './network';

export interface RouterTx {
  txid: string;
  functionName: string;
  sender: string;
  status: string;
  sponsored: boolean;
  amountSats: number | null; // deposits carry an amount arg; other calls don't
  strategy: string | null;
  timeIso: string | null;
}

export interface RouterStats {
  txs: RouterTx[];
  totalDeposits: number;
  totalWithdrawals: number;
  depositVolumeSats: number;
  uniqueUsers: number;
  sponsoredCount: number;
  routerId: string | null;
}

interface HiroArg {
  name: string;
  repr: string;
}

function parseUintRepr(repr: string | undefined): number | null {
  if (!repr) return null;
  const m = repr.match(/^u(\d+)$/);
  return m ? Number(m[1]) : null;
}

function parseAsciiRepr(repr: string | undefined): string | null {
  if (!repr) return null;
  const m = repr.match(/^"(.*)"$/);
  return m ? m[1] : null;
}

/**
 * Reads the yield-router's on-chain transaction history from the canonical
 * Stacks (Hiro) API and derives headline stats. This is real, verifiable
 * activity — every row links to the public explorer.
 */
export async function fetchRouterStats(limit = 50): Promise<RouterStats> {
  const empty: RouterStats = {
    txs: [],
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositVolumeSats: 0,
    uniqueUsers: 0,
    sponsoredCount: 0,
    routerId: YIELD_ROUTER ? toContractId(YIELD_ROUTER) : null,
  };
  if (!YIELD_ROUTER) return empty;

  const routerId = toContractId(YIELD_ROUTER);
  const res = await fetch(
    `${HIRO_API_URL}/extended/v1/address/${routerId}/transactions?limit=${limit}`
  );
  if (!res.ok) return empty;
  const data: { results?: Array<Record<string, unknown>> } = await res.json();

  const txs: RouterTx[] = [];
  for (const item of data.results ?? []) {
    // v1 returns tx objects directly; some endpoints wrap them in `.tx`.
    const tx = (item.tx ?? item) as Record<string, unknown>;
    if (tx.tx_type !== 'contract_call') continue;
    const cc = tx.contract_call as { function_name: string; function_args?: HiroArg[] };
    const args = cc.function_args ?? [];
    const amountArg = args.find((a) => a.name === 'amount');
    const strategyArg = args.find((a) => a.name === 'strategy-name');

    txs.push({
      txid: tx.tx_id as string,
      functionName: cc.function_name,
      sender: tx.sender_address as string,
      status: tx.tx_status as string,
      sponsored: Boolean(tx.sponsored),
      amountSats: parseUintRepr(amountArg?.repr),
      strategy: parseAsciiRepr(strategyArg?.repr),
      timeIso: (tx.burn_block_time_iso as string) ?? null,
    });
  }

  const deposits = txs.filter((t) => t.functionName === 'deposit' && t.status === 'success');
  const withdrawals = txs.filter((t) => t.functionName === 'withdraw' && t.status === 'success');
  const users = new Set(
    txs.filter((t) => t.functionName === 'deposit' || t.functionName === 'withdraw').map((t) => t.sender)
  );

  return {
    txs,
    totalDeposits: deposits.length,
    totalWithdrawals: withdrawals.length,
    depositVolumeSats: deposits.reduce((sum, t) => sum + (t.amountSats ?? 0), 0),
    uniqueUsers: users.size,
    sponsoredCount: txs.filter((t) => t.sponsored).length,
    routerId,
  };
}

/** Serializes the transaction list to CSV for download as evidence. */
export function txsToCsv(txs: RouterTx[]): string {
  const header = ['txid', 'function', 'sender', 'status', 'sponsored', 'amount_sats', 'strategy', 'time'];
  const rows = txs.map((t) =>
    [t.txid, t.functionName, t.sender, t.status, t.sponsored, t.amountSats ?? '', t.strategy ?? '', t.timeIso ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
