'use client';

import { motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { txsToCsv } from '@/lib/stacks/analytics';
import { fadeSlideUp } from '@/lib/motion';
import { useAppData } from '@/lib/app-data';
import { ConnectPrompt } from '../../components/ConnectPrompt';
import { Card, PageTitle, Skeleton, TxRow } from '../../components/app/ui';

export default function ActivityPage() {
  const { isConnected } = useWallet();
  const { activity } = useAppData();

  const exportCsv = () => {
    if (!activity) return;
    const blob = new Blob([txsToCsv(activity)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bityield-activity.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial="initial" animate="animate" variants={fadeSlideUp} className="xl:mx-auto xl:max-w-3xl">
      <PageTitle sub="Every deposit and withdrawal, straight from the chain.">Activity</PageTitle>

      {!isConnected && <ConnectPrompt description="Connect your wallet to see your activity." />}

      {isConnected && activity === null && (
        <Card className="divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <Skeleton className="h-10 w-10 !rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </Card>
      )}

      {isConnected && activity !== null && activity.length === 0 && (
        <Card className="p-8 text-center">
          <p className="font-display text-lg font-semibold">No activity yet</p>
          <p className="mt-2 text-sm text-zinc-400">Your deposits and withdrawals will show up here.</p>
        </Card>
      )}

      {isConnected && activity !== null && activity.length > 0 && (
        <>
          <Card className="divide-y divide-line overflow-hidden">
            {activity.map((t) => (
              <TxRow key={t.txid} tx={t} />
            ))}
          </Card>
          <button onClick={exportCsv} className="mt-4 text-sm text-zinc-500 transition-colors hover:text-white">
            Export as CSV
          </button>
        </>
      )}
    </motion.div>
  );
}
