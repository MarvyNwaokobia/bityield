'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { NETWORK_NAME } from '@/lib/stacks/network';
import { fadeSlideUp } from '@/lib/motion';
import { ConnectPrompt } from '../../components/ConnectPrompt';
import { BookIcon, ChevronRightIcon, CopyIcon, LogoutIcon, ShieldIcon } from '../../components/app/Icons';
import { Card, PageTitle } from '../../components/app/ui';

function LinkRow({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-zinc-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
      <ChevronRightIcon className="h-4 w-4 text-zinc-600" />
    </Link>
  );
}

export default function AccountPage() {
  const { address, isConnected, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable, ignore.
    }
  };

  return (
    <motion.div initial="initial" animate="animate" variants={fadeSlideUp} className="space-y-6">
      <PageTitle>Account</PageTitle>

      {!isConnected || !address ? (
        <ConnectPrompt />
      ) : (
        <Card className="p-5">
          <p className="text-xs text-zinc-500">Connected wallet · Stacks {NETWORK_NAME}</p>
          <p className="mt-2 break-all font-mono text-sm text-zinc-200">{address}</p>
          <button
            onClick={copy}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            <CopyIcon className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </Card>
      )}

      <Card className="divide-y divide-line overflow-hidden">
        <LinkRow href="/proof" icon={<ShieldIcon className="h-5 w-5" />} label="Live proof" sub="Verified on-chain activity" />
        <LinkRow href="/docs" icon={<BookIcon className="h-5 w-5" />} label="Docs and FAQ" sub="How BitYield works, risks, bridging" />
        <LinkRow href="/privacy" icon={<ShieldIcon className="h-5 w-5" />} label="Privacy" sub="What we collect and why" />
      </Card>

      {isConnected && (
        <button
          onClick={disconnect}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/5"
        >
          <LogoutIcon className="h-4 w-4" />
          Sign out
        </button>
      )}
    </motion.div>
  );
}
