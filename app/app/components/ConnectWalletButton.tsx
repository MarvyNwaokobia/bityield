'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { hoverScale, springTransition, tapScale } from '@/lib/motion';

function truncate(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [justConnected, setJustConnected] = useState(false);
  const wasConnected = useRef(false);

  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      setJustConnected(true);
      const timeout = setTimeout(() => setJustConnected(false), 1800);
      wasConnected.current = isConnected;
      return () => clearTimeout(timeout);
    }
    wasConnected.current = isConnected;
  }, [isConnected]);

  if (isConnected && address) {
    return (
      <motion.button
        type="button"
        onClick={disconnect}
        title="Disconnect wallet"
        whileHover={hoverScale}
        whileTap={tapScale}
        transition={springTransition}
        className="font-mono text-sm border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg hover:border-zinc-500 hover:text-white transition-colors inline-flex items-center gap-2"
      >
        <span className="relative flex h-2 w-2">
          {justConnected && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 motion-safe:animate-ping opacity-75" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        {truncate(address)}
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={connect}
      disabled={isConnecting}
      whileHover={isConnecting ? undefined : hoverScale}
      whileTap={isConnecting ? undefined : tapScale}
      transition={springTransition}
      className="text-sm font-semibold border border-bitcoin text-bitcoin px-4 py-2 rounded-lg hover:bg-bitcoin hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
    >
      {isConnecting && (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-bitcoin/30 border-t-bitcoin animate-spin" />
      )}
      {isConnecting ? 'Connecting…' : 'Connect Wallet'}
    </motion.button>
  );
}
