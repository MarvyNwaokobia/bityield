import { ClarityType, Cl, fetchCallReadOnlyFunction } from '@stacks/transactions';
import { network, SBTC_TOKEN } from './network';

/**
 * Reads the user's sBTC balance in sats via the token contract's SIP-010
 * `get-balance`. Falls back to 0n if the token contract isn't configured yet
 * (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS unset) or the read fails.
 * Includes injection of localStorage mock balance for simulated peg-in flow.
 */
export async function getSbtcBalanceSats(address: string): Promise<bigint> {
  let balance = 0n;

  if (SBTC_TOKEN) {
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
        balance = BigInt(result.value.value);
      }
    } catch {
      // Token contract not deployed/reachable yet — fall back to local balance logic.
    }
  }

  // Inject local storage mock balance for simulated peg-in testing
  if (typeof window !== 'undefined') {
    const mockBal = localStorage.getItem(`mock-sbtc-balance-${address}`);
    if (mockBal) {
      balance += BigInt(mockBal);
    }
  }

  return balance;
}
