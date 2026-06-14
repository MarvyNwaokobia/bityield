'use client';

import { useWallet } from '@/lib/stacks/wallet';

function truncate(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        title="Disconnect wallet"
        className="font-mono text-sm border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg hover:border-zinc-500 hover:text-white transition-colors"
      >
        {truncate(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={isConnecting}
      className="text-sm font-semibold border border-[#F7931A] text-[#F7931A] px-4 py-2 rounded-lg hover:bg-[#F7931A] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isConnecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
