'use client';

import { useWallet } from '@/lib/stacks/wallet';

export function ConnectPrompt({
  description = 'Connect your Stacks wallet to see your balance and continue.',
}: {
  description?: string;
}) {
  const { connect, isConnecting } = useWallet();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <p className="text-xl font-semibold mb-2">Connect your wallet</p>
      <p className="text-zinc-400 mb-8 leading-relaxed">{description}</p>
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className="w-full bg-[#F7931A] text-black font-bold px-6 py-4 rounded-xl text-lg hover:bg-[#e8841a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    </div>
  );
}
