import type { ReactNode } from 'react';
import { AppShell } from '../components/app/AppShell';
import { AppDataProvider } from '@/lib/app-data';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
