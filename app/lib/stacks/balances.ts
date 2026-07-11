import { ClarityType, Cl, fetchCallReadOnlyFunction } from '@stacks/transactions';
import { network, SBTC_TOKEN } from './network';

/**
 * Reads the user's sBTC balance in sats via the token contract's SIP-010
 * `get-balance`. Returns 0n if the token contract isn't configured yet
 * (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS unset) or the read fails.
 *
 * This is the real on-chain balance only — no simulated/local balances are
 * ever mixed in, so what the UI shows always matches what a deposit can
 * actually move.
 */
export async function getSbtcBalanceSats(address: string): Promise<bigint> {
  if (!SBTC_TOKEN) return 0n;

  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: SBTC_TOKEN.address,
      contractName: SBTC_TOKEN.name,
      functionName: 'get-balance',
      functionArgs: [Cl.principal(address)],
      senderAddress: address,
      network,
    });

    if (result.type === ClarityType.ResponseOk && result.value.type === ClarityType.UInt) {
      return BigInt(result.value.value);
    }
  } catch {
    // Token contract not deployed/reachable yet — report zero rather than
    // guessing, so the UI never shows sBTC the user doesn't actually hold.
  }

  return 0n;
}
