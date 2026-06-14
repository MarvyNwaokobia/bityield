import { NextResponse } from 'next/server';
import { broadcastTransaction, deserializeTransaction, sponsorTransaction } from '@stacks/transactions';
import { network } from '@/lib/stacks/network';

export async function POST(request: Request) {
  const sponsorKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKey) {
    return NextResponse.json(
      { error: 'Fee sponsorship is not configured on this server (SPONSOR_PRIVATE_KEY is unset).' },
      { status: 500 }
    );
  }

  const body: { serializedTx?: string } = await request.json();
  if (!body.serializedTx) {
    return NextResponse.json({ error: 'Missing serializedTx.' }, { status: 400 });
  }

  try {
    const transaction = deserializeTransaction(body.serializedTx);
    const sponsoredTx = await sponsorTransaction({
      transaction,
      sponsorPrivateKey: sponsorKey,
      network,
    });

    const result = await broadcastTransaction({ transaction: sponsoredTx, network });
    if ('error' in result) {
      const reason = 'reason_data' in result && result.reason_data && 'message' in result.reason_data
        ? result.reason_data.message
        : result.reason;
      return NextResponse.json({ error: `${result.error}: ${reason}` }, { status: 400 });
    }

    return NextResponse.json({ txid: result.txid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sponsor transaction.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
