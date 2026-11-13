'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Logo } from '../Logo';
import { ConnectWalletButton } from '../ConnectWalletButton';
import { AccountIcon, ActivityIcon, EarnIcon, HomeIcon } from './Icons';

const TABS = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon },
  { href: '/earn', label: 'Earn', Icon: EarnIcon },
  { href: '/activity', label: 'Activity', Icon: ActivityIcon },
  { href: '/account', label: 'Account', Icon: AccountIcon },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar() {
  const isActive = useActive();
  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-[#0a0a0a] px-4 py-6">
      <div className="px-2 mb-8">
        <Logo />
      </div>
      <nav className="flex flex-col gap-1" aria-label="Main">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-surface-2 border border-line"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={`relative w-5 h-5 ${active ? 'text-bitcoin' : ''}`} />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        <Link
          href="/deposit"
          className="rounded-xl bg-bitcoin px-4 py-3 text-center text-sm font-bold text-black hover:bg-bitcoin-dark transition-colors"
        >
          Deposit
        </Link>
        <ConnectWalletButton />
      </div>
    </aside>
  );
}

function BottomNav() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-[#0a0a0a]/90 backdrop-blur-lg safe-bottom"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${
                  active ? 'text-bitcoin' : 'text-zinc-500'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-bitcoin"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="w-6 h-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Sidebar />
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[#0a0a0a]/90 px-4 py-3 backdrop-blur-lg">
        <Logo />
        <ConnectWalletButton />
      </header>
      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-28 md:max-w-3xl md:px-8 md:pt-10 md:pb-16 xl:max-w-6xl xl:px-12">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
