'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWallet } from '@/lib/stacks/wallet';
import { hoverScale, springTransition, tapScale } from '@/lib/motion';

function truncate(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [justConnected, setJustConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wasConnected = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      setJustConnected(true);
      const timeout = setTimeout(() => setJustConnected(false), 1800);
      wasConnected.current = isConnected;
      return () => clearTimeout(timeout);
    }
    wasConnected.current = isConnected;
  }, [isConnected]);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable, silently ignore.
    }
  };

  if (isConnected && address) {
    return (
      <div ref={containerRef} className="relative">
        <motion.button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Wallet options"
          whileTap={tapScale}
          transition={springTransition}
          className="font-mono text-sm border border-zinc-700 text-zinc-300 px-3 sm:px-4 py-2 rounded-lg hover:border-zinc-500 hover:text-white transition-colors inline-flex items-center gap-2 whitespace-nowrap"
        >
          <span className="relative flex h-2 w-2">
            {justConnected && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 motion-safe:animate-ping opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {truncate(address)}
          <svg
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              role="menu"
              className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={copyAddress}
                className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors inline-flex items-center gap-2.5"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m11.25 3.375h-3.375A1.125 1.125 0 0113.5 8.625v-3.375m0 0v-.375a1.125 1.125 0 011.125-1.125H18a1.125 1.125 0 011.125 1.125v.375"
                  />
                </svg>
                {copied ? 'Copied!' : 'Copy address'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  disconnect();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors inline-flex items-center gap-2.5 border-t border-zinc-800"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                  />
                </svg>
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
      className="text-sm font-semibold border border-bitcoin text-bitcoin px-3 sm:px-4 py-2 rounded-lg hover:bg-bitcoin hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
    >
      {isConnecting && (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-bitcoin/30 border-t-bitcoin animate-spin" />
      )}
      {isConnecting ? 'Connecting…' : 'Connect Wallet'}
    </motion.button>
  );
}
