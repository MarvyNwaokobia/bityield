import { NextResponse } from 'next/server';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import { HIRO_API_URL, NETWORK_NAME } from '@/lib/stacks/network';

export async function GET() {
  const sponsorKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKey) {
    return NextResponse.json(
      { error: 'Fee sponsorship is not configured on this server (SPONSOR_PRIVATE_KEY is unset).' },
      { status: 500 }
    );
  }

  try {
    // Derive address from private key using the network name
    const address = getAddressFromPrivateKey(
      sponsorKey,
      NETWORK_NAME === 'mainnet' ? 'mainnet' : 'testnet'
    );

    // Query Hiro Extended API for address balances
    const url = `${HIRO_API_URL}/extended/v1/address/${address}/balances`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to query balances from Hiro API. Status: ${res.status}`);
    }

    const data = await res.json();
    const stxBalanceMicro = BigInt(data.stx.balance || '0');
    const stxBalance = Number(stxBalanceMicro) / 1_000_000;

    // Classify status
    let status: 'safe' | 'low' | 'depleted' = 'safe';
    let warning = '';

    if (stxBalance <= 2.0) {
      status = 'depleted';
      warning = 'CRITICAL: Sponsor account balance is extremely low and may fail transactions soon. Refill STX immediately.';
    } else if (stxBalance <= 10.0) {
      status = 'low';
      warning = 'WARNING: Sponsor account balance is running low. Please refill STX to prevent downtime.';
    }

    return NextResponse.json({
      address,
      balanceStx: stxBalance,
      balanceMicroStx: stxBalanceMicro.toString(),
      status,
      warning,
      network: NETWORK_NAME,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query sponsor account health.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
