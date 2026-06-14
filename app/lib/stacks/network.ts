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

// Set after running `clarinet deployments apply --testnet` — see contracts/DEPLOYMENT.md.
export const YIELD_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_YIELD_ROUTER_ADDRESS ?? "";

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
