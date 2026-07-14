import { STACKS_MAINNET, STACKS_TESTNET, type StacksNetwork } from "@stacks/network";
import type { ContractIdString } from "@stacks/transactions";

export type StacksNetworkName = "mainnet" | "testnet";

export const NETWORK_NAME: StacksNetworkName =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const network: StacksNetwork =
  NETWORK_NAME === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

export const HIRO_API_URL =
  process.env.NEXT_PUBLIC_HIRO_API_URL ??
  (NETWORK_NAME === "mainnet" ? "https://api.mainnet.hiro.so" : "https://api.testnet.hiro.so");

// Where a user actually acquires sBTC. On mainnet this is the official sBTC
// bridge (send BTC, receive 1:1 sBTC); on testnet the Hiro Platform faucet
// dispenses testnet sBTC directly. BitYield does not bridge funds itself — it
// links out to the real flow rather than simulating one.
export const SBTC_ACQUIRE_URL =
  process.env.NEXT_PUBLIC_SBTC_ACQUIRE_URL ??
  (NETWORK_NAME === "mainnet" ? "https://sbtc.stacks.co" : "https://platform.hiro.so");

// Set after running `clarinet deployments apply --testnet` — see contracts/DEPLOYMENT.md.
export const YIELD_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_YIELD_ROUTER_ADDRESS ?? "";

// Mock strategy contract address, defaulting to same deployer prefix if unset
export const MOCK_YIELD_STRATEGY_ADDRESS =
  process.env.NEXT_PUBLIC_MOCK_YIELD_STRATEGY_ADDRESS ??
  (YIELD_ROUTER_ADDRESS ? `${YIELD_ROUTER_ADDRESS.split('.')[0]}.mock-yield-strategy` : "");

// Zest strategy contract address, defaulting to same deployer prefix if unset
export const ZEST_STRATEGY_ADDRESS =
  process.env.NEXT_PUBLIC_ZEST_STRATEGY_ADDRESS ??
  (YIELD_ROUTER_ADDRESS ? `${YIELD_ROUTER_ADDRESS.split('.')[0]}.zest-strategy` : "");

// Hermetica strategy contract address, defaulting to same deployer prefix if unset
export const HERMETICA_STRATEGY_ADDRESS =
  process.env.NEXT_PUBLIC_HERMETICA_STRATEGY_ADDRESS ??
  (YIELD_ROUTER_ADDRESS ? `${YIELD_ROUTER_ADDRESS.split('.')[0]}.hermetica-strategy` : "");

// Dual Stacking strategy contract address, defaulting to same deployer prefix if unset
export const DUAL_STRATEGY_ADDRESS =
  process.env.NEXT_PUBLIC_DUAL_STRATEGY_ADDRESS ??
  (YIELD_ROUTER_ADDRESS ? `${YIELD_ROUTER_ADDRESS.split('.')[0]}.dual-stacking-strategy` : "");

// Falls back to this project's mock-sbtc-token (deployed alongside yield-router)
// until the real sBTC testnet token principal is known — see contracts/DEPLOYMENT.md.
export const SBTC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS ?? "";

export interface ContractRef {
  address: string;
  name: string;
}

export function parseContractId(id: string): ContractRef | null {
  const dot = id.indexOf(".");
  if (dot <= 0 || dot === id.length - 1) return null;
  return { address: id.slice(0, dot), name: id.slice(dot + 1) };
}

export function toContractId(ref: ContractRef): ContractIdString {
  return `${ref.address}.${ref.name}` as ContractIdString;
}

export const YIELD_ROUTER = parseContractId(YIELD_ROUTER_ADDRESS);
export const SBTC_TOKEN = parseContractId(SBTC_CONTRACT_ADDRESS);

export const MOCK_YIELD_STRATEGY = parseContractId(MOCK_YIELD_STRATEGY_ADDRESS);
export const ZEST_STRATEGY = parseContractId(ZEST_STRATEGY_ADDRESS);
export const HERMETICA_STRATEGY = parseContractId(HERMETICA_STRATEGY_ADDRESS);
export const DUAL_STRATEGY = parseContractId(DUAL_STRATEGY_ADDRESS);

export type StrategyName = "zest" | "hermetica" | "dual-stacking" | "mock-yield";

export const STRATEGIES: Record<StrategyName, ContractRef | null> = {
  "mock-yield": MOCK_YIELD_STRATEGY,
  "zest": ZEST_STRATEGY,
  "hermetica": HERMETICA_STRATEGY,
  "dual-stacking": DUAL_STRATEGY,
};

// Hiro explorer link for a "<address>.<contract-name>" id, so users can verify
// exactly what a strategy contract does on-chain.
export function explorerContractUrl(contractId: string): string {
  const chain = NETWORK_NAME === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.hiro.so/txid/${contractId}?chain=${chain}`;
}

// Hiro explorer link for a transaction id, so users can watch their own
// deposit/withdraw confirm on-chain in real time.
export function explorerTxUrl(txid: string): string {
  const chain = NETWORK_NAME === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.hiro.so/txid/${txid}?chain=${chain}`;
}

// Resolves a strategy name to the deployed contract id, or null if unset.
export function strategyContractId(name: StrategyName): string | null {
  const ref = STRATEGIES[name];
  return ref ? toContractId(ref) : null;
}
