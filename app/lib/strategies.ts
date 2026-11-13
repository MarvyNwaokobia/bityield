import type { StrategyName } from './stacks/network';

export type RouteStatus = 'live' | 'deployed' | 'preview';

export interface StrategyOption {
  id: StrategyName;
  name: string;
  apy: number;
  targetProtocol: string;
  risk: 'Low' | 'Medium';
  status: RouteStatus;
  desc: string;
  riskNote: string;
  disabled?: boolean;
}

// Honest, per-route status: 'live' routes real sBTC into the named protocol on
// Bitcoin mainnet today. 'deployed' means the live contract is on mainnet and
// registered, but has not yet completed a full real-fund test. 'preview' means
// BitYield's own strategy contract paying a fixed, admin-set APY, modelling
// the target protocol without routing to it. See the Risk & disclosures panel
// on confirm for the route-specific detail.
//
// `apy` below is the fallback shown before/if the live read (see
// `getLiveApyPercent`) resolves — Zest and Dual Stacking both replace it with
// the real on-chain rate once loaded, since both now have a verified
// conversion from the strategy's raw `get-apy`.
export const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    id: 'zest', name: 'Zest Lending', apy: 4.5, targetProtocol: 'Zest Protocol', risk: 'Low', status: 'live',
    desc: 'Routes your sBTC into real Zest Protocol lending on Bitcoin mainnet. The rate shown is read live from Zest’s sBTC reserve.',
    riskNote: 'This route is live on Bitcoin mainnet: your deposit is actually supplied into Zest Protocol’s lending pool. It is a new deployment, unaudited, and has had limited real-world testing so far — deposit only a small amount you are comfortable testing with.',
  },
  {
    id: 'dual-stacking', name: 'Dual Stacking', apy: 8.5, targetProtocol: 'Stacks PoX', risk: 'Low', status: 'live',
    desc: 'Enrolls your sBTC in the Stacks network’s own Dual Stacking rewards program. A full deposit-and-withdraw round trip is confirmed on mainnet; actual reward payout is still pending its first reward cycle.',
    riskNote: 'This route is live on Bitcoin mainnet: your deposit is actually enrolled in the real Stacks Dual Stacking rewards program, and a full deposit-and-withdraw round trip has been confirmed on-chain. It is a new deployment, unaudited, and reward payout has not been confirmed yet (enrollment activates the following reward cycle, roughly two weeks) — deposit only a small amount you are comfortable testing with.',
  },
  {
    id: 'hermetica', name: 'Hermetica Structured', apy: 6.2, targetProtocol: 'Hermetica', risk: 'Medium', status: 'preview',
    desc: 'Models Hermetica structured yield. Today a BitYield strategy contract paying a fixed 6.2% APY. Live routing is on the roadmap.',
    riskNote: 'Preview strategy. Hermetica Structured is a BitYield strategy contract paying a fixed 6.2% APY. It models Hermetica but does not route to it yet; the rate is set by the contract, not live market yield.',
  },
];
