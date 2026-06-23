'use client';

/**
 * Holder session context — wraps the WalletConnector seam and exposes a
 * clean hook to the rest of the app.
 *
 * Persistence decision (documented for PR):
 *   In Batch 1 we persist the connected address in localStorage under the key
 *   'acta:session:address'. This is intentionally simple — no JWT, no signing,
 *   no real auth. When the real wallet is wired (later batch), the connector
 *   itself will handle persistence (Freighter remembers the permission grant).
 *   sessionStorage was considered but rejected: it does not survive a tab
 *   refresh, which breaks the UX acceptance criterion.
 *
 * Network:
 *   Read from NEXT_PUBLIC_STELLAR_NETWORK (same env var as ActaProvider).
 *   DID is always derived with didPkhStellar — never constructed by hand.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { didPkhStellar } from '@acta-products/acta/did';
import type { StellarNetwork } from '@acta-products/acta/did';
import { getWalletConnector } from './wallet-connector';

// Next.js inlines NEXT_PUBLIC_* at build time.
declare const NEXT_PUBLIC_STELLAR_NETWORK: string | undefined;

function resolveNetwork(): StellarNetwork {
  const raw =
    typeof NEXT_PUBLIC_STELLAR_NETWORK !== 'undefined'
      ? (NEXT_PUBLIC_STELLAR_NETWORK as string)
      : 'testnet';
  return raw === 'mainnet' ? 'mainnet' : 'testnet';
}

const SESSION_STORAGE_KEY = 'acta:session:address';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionStatus = 'disconnected' | 'connecting' | 'connected';

export interface SessionState {
  status: SessionStatus;
  /** Stellar G... address, or null when disconnected. */
  address: string | null;
  /** Full DID in format did:pkh:stellar:{network}:{G...}, or null when disconnected. */
  did: string | null;
  /** Initiate wallet connection. */
  connect: () => Promise<void>;
  /** Clear the session. */
  disconnect: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SessionContext = createContext<SessionState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [address, setAddress] = useState<string | null>(null);

  const network = resolveNetwork();

  // Restore session from localStorage on mount (survives page refresh).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAddress(stored);
        setStatus('connected');
      }
    } catch {
      // localStorage may be unavailable (SSR guard, private browsing).
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    try {
      const connector = getWalletConnector();
      const { address: addr } = await connector.connect();
      setAddress(addr);
      setStatus('connected');
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, addr);
      } catch {
        // Non-fatal — session lives in memory for this tab.
      }
    } catch (err) {
      setStatus('disconnected');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const connector = getWalletConnector();
    await connector.disconnect();
    setAddress(null);
    setStatus('disconnected');
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Non-fatal.
    }
  }, []);

  const did = address !== null ? didPkhStellar(network, address) : null;

  return (
    <SessionContext.Provider value={{ status, address, did, connect, disconnect }}>
      {children}
    </SessionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the holder session from any Client Component.
 * Must be used inside <SessionProvider>.
 */
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession() must be used inside <SessionProvider>.');
  }
  return ctx;
}
