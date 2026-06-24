'use client';

import { motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { fadeSlideUp } from '@/lib/motion';
import { PrimaryButton } from './Button';

export function ConnectPrompt({
  description = 'Connect your Stacks wallet to see your balance and continue.',
}: {
  description?: string;
}) {
  const { connect, isConnecting } = useWallet();

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeSlideUp}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
    >
      <p className="font-display text-xl font-semibold mb-2">Connect your wallet</p>
      <p className="text-zinc-400 mb-8 leading-relaxed">{description}</p>
      <PrimaryButton onClick={connect} loading={isConnecting} className="w-full px-6 py-4 text-lg">
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </PrimaryButton>
    </motion.div>
  );
}
