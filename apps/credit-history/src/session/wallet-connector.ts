/**
 * Wallet connection seam — mock implementation for Batch 1.
 *
 * The WalletConnector interface is the only boundary the session layer
 * (SessionProvider / useSession) ever sees. Getting the G... address and
 * signTransaction is this module's responsibility; the ACTA SDK does NOT
 * connect wallets.
 *
 * SEAM: when the real wallet is integrated, this factory will return a
 * connector based on Freighter / Stellar Wallets Kit (provides address G...
 * and signTransaction). The UI does not change — only this factory and the
 * concrete class below get replaced.
 */

// ─── Interface ───────────────────────────────────────────────────────────────

export interface WalletConnector {
  /** Resolves with the holder's Stellar account address (G...). */
  connect(): Promise<{ address: string }>;
  /** Clears the active session. */
  disconnect(): Promise<void>;
}

// ─── Mock implementation ──────────────────────────────────────────────────────

/**
 * Sample G... address from the ACTA brand book.
 * In Batch 1, all "connections" resolve to this fixed address so the rest of
 * the UI can be built and tested without a real wallet.
 */
const MOCK_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

class MockWalletConnector implements WalletConnector {
  async connect(): Promise<{ address: string }> {
    // Simulate wallet approval latency
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { address: MOCK_ADDRESS };
  }

  async disconnect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

// ─── Seam factory ─────────────────────────────────────────────────────────────

// SEAM: today this returns MockWalletConnector. When the real wallet is
// integrated, this factory will return a connector based on Freighter /
// Stellar Wallets Kit that provides:
//   - address: the holder's G... account
//   - signTransaction: (xdr, { networkPassphrase }) => Promise<string>
// The UI (SessionProvider, useSession, header button) does NOT change.
export function getWalletConnector(): WalletConnector {
  return new MockWalletConnector();
}
