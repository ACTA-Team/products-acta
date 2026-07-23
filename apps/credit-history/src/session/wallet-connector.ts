/**
 * @fileoverview Wallet connector factory and implementations.
 *
 * The WalletConnector interface is the only contract the rest of the app
 * (SessionProvider, useSession, WalletButton) depends on. Both connectors
 * implement it; the factory decides which one to return at runtime.
 *
 * Gate:
 *   NEXT_PUBLIC_WALLET=real   → RealWalletConnector (Stellar Wallets Kit)
 *   anything else / unset     → MockWalletConnector  (CI / dev without extension)
 *
 * Issue #35 — replace the SEAM mock with a real Freighter / SWK connector.
 *
 * NOTE ON THE PACKAGE VERSION:
 * @creit.tech/stellar-wallets-kit went through a breaking v1 → v2 rewrite.
 * As of v2.x, `StellarWalletsKit` is a *static* class (no `new`), there is
 * no `WalletNetwork` export (use `Networks`, whose enum values ARE the
 * passphrase strings), and `FreighterModule` lives under the
 * `/modules/freighter` subpath instead of the package root. This file
 * targets v2.x. Pin the exact version in package.json (see PR notes) so a
 * future `pnpm up` doesn't silently break this again.
 */

'use client';

import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface SignTransactionOpts {
  networkPassphrase: string;
  address?: string;
}

export interface WalletConnector {
  connect(): Promise<{ address: string }>;
  signTransaction?: (xdr: string, opts: SignTransactionOpts) => Promise<{ signedXdr: string }>;
  disconnect(): Promise<void>;
}

// ── Network helpers ───────────────────────────────────────────────────────────

export function resolveNetworkPassphrase(): Networks {
  const raw = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  switch (raw.toLowerCase()) {
    case 'mainnet':
    case 'public':
      return Networks.PUBLIC;
    case 'futurenet':
      return Networks.FUTURENET;
    default:
      return Networks.TESTNET;
  }
}

// ── Error types ───────────────────────────────────────────────────────────────

export class WalletNotInstalledError extends Error {
  constructor(walletName = 'wallet') {
    super(
      `${walletName} is not installed. ` +
        'Please install it from the browser extension store and try again.'
    );
    this.name = 'WalletNotInstalledError';
  }
}

export class UserRejectedError extends Error {
  constructor() {
    super('Connection request was rejected by the user.');
    this.name = 'UserRejectedError';
  }
}

// ── MockWalletConnector ───────────────────────────────────────────────────────

const MOCK_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

class MockWalletConnector implements WalletConnector {
  async connect(): Promise<{ address: string }> {
    return { address: MOCK_ADDRESS };
  }

  async disconnect(): Promise<void> {
    // Mock implementation - no-op
  }

  /** Returns the input XDR unchanged — suitable only for dev/CI. */
  async signTransaction(xdr: string): Promise<{ signedXdr: string }> {
    return { signedXdr: xdr };
  }
}

// ── RealWalletConnector ───────────────────────────────────────────────────────

let initialized = false;

class RealWalletConnector implements WalletConnector {
  private readonly networkPassphrase: Networks;

  constructor() {
    this.networkPassphrase = resolveNetworkPassphrase();

    if (!initialized) {
      StellarWalletsKit.init({
        modules: [new FreighterModule()],
        network: this.networkPassphrase,
      });
      initialized = true;
    } else {
      // Keep the singleton's network in sync in case NEXT_PUBLIC_STELLAR_NETWORK
      // changed between renders (e.g. hot reload with a different env value).
      StellarWalletsKit.setNetwork(this.networkPassphrase);
    }
  }
  disconnect(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async connect(): Promise<{ address: string }> {
    try {
      const { address } = await StellarWalletsKit.authModal();
      return { address };
    } catch (err) {
      throw this.classifyError(err);
    }
  }

  async signTransaction(xdr: string, opts: SignTransactionOpts): Promise<{ signedXdr: string }> {
    try {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: opts.networkPassphrase ?? this.networkPassphrase,
        address: opts.address,
      });
      return { signedXdr: signedTxXdr };
    } catch (err) {
      throw this.classifyError(err);
    }
  }

  private classifyError(err: unknown): Error {
    if (err instanceof WalletNotInstalledError || err instanceof UserRejectedError) {
      return err;
    }

    const rawMessage =
      (err as { message?: unknown } | null)?.message ??
      (err instanceof Error ? err.message : undefined) ??
      String(err);
    const msg = String(rawMessage).toLowerCase();

    if (
      msg.includes('not installed') ||
      msg.includes('not available') ||
      msg.includes('not connected') ||
      msg.includes('extension not found') ||
      msg.includes('no provider')
    ) {
      return new WalletNotInstalledError('Freighter');
    }

    if (
      msg.includes('rejected') ||
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('closed the modal') ||
      msg.includes('user denied') ||
      msg.includes('user closed')
    ) {
      return new UserRejectedError();
    }

    return err instanceof Error ? err : new Error(String(rawMessage));
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function getWalletConnector(): WalletConnector {
  if (process.env.NEXT_PUBLIC_WALLET === 'real') {
    return new RealWalletConnector();
  }
  return new MockWalletConnector();
}
