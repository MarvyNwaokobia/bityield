import { ClarityType, Cl, fetchCallReadOnlyFunction } from '@stacks/transactions';
import { network, SBTC_TOKEN } from './network';

/**
 * Reads the user's sBTC balance in sats via the token contract's SIP-010
 * `get-balance`. Falls back to 0n if the token contract isn't configured yet
 * (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS unset) or the read fails.
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
    // Token contract not deployed/reachable yet — treat as zero balance.
  }

  return 0n;
}
