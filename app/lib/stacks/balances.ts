import { Cl, fetchCallReadOnlyFunction, type UIntCV } from '@stacks/transactions';
import { network, SBTC_TOKEN } from './network';
import { CT, cvType } from './clarity-runtime';

/**
 * Reads the user's sBTC balance in sats via the token contract's SIP-010
 * `get-balance`. Returns 0n if the token contract isn't configured
 * (NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS unset).
 *
 * Throws if the on-chain read fails or returns an unexpected shape, so callers
 * can distinguish "the wallet genuinely holds 0" from "we couldn't read the
 * balance" — the UI must never claim the user has no sBTC on a failed read.
 *
 * The comparison uses string wire-types via {@link cvType} rather than the
 * `ClarityType` enum object, which is tree-shaken out of production bundles —
 * see clarity-runtime.ts.
 */
export async function getSbtcBalanceSats(address: string): Promise<bigint> {
  if (!SBTC_TOKEN) return 0n;

  const result = await fetchCallReadOnlyFunction({
    contractAddress: SBTC_TOKEN.address,
    contractName: SBTC_TOKEN.name,
    functionName: 'get-balance',
    functionArgs: [Cl.principal(address)],
    senderAddress: address,
    network,
  });

  // get-balance returns (response uint uint); unwrap the ok branch.
  if (cvType(result) === CT.ok) {
    const inner = (result as { value: unknown }).value;
    if (cvType(inner) === CT.uint) {
      return BigInt((inner as UIntCV).value);
    }
  }

  throw new Error(`Unexpected get-balance response: ${cvType(result)}`);
}
