'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  connect as connectWallet,
  disconnect as disconnectWallet,
  getLocalStorage,
  isConnected as isWalletConnected,
} from '@stacks/connect';
import { NETWORK_NAME } from './network';

interface WalletContextValue {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function readStoredAddress(): string | null {
  if (!isWalletConnected()) return null;
  return getLocalStorage()?.addresses.stx[0]?.address ?? null;
}

// The connected address lives in @stacks/connect's localStorage, outside of
// React. useSyncExternalStore reads it in a hydration-safe way (server
// snapshot is always `null`, then the real value is picked up on the client)
// without an effect that calls setState on mount.
type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyWalletChanged() {
  listeners.forEach((listener) => listener());
}

function getServerSnapshot(): string | null {
  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const address = useSyncExternalStore(subscribe, readStoredAddress, getServerSnapshot);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await connectWallet({ network: NETWORK_NAME });
      notifyWalletChanged();
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectWallet();
    notifyWalletChanged();
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, isConnected: address !== null, isConnecting, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
