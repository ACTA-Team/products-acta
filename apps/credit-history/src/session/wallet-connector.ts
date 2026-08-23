/**
 * @fileoverview Wallet connector factory and implementations.
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
import { Keypair } from '@stellar/stellar-sdk';
import { sep0053MessageHash } from '@acta-products/acta/presentation';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface SignTransactionOpts {
  networkPassphrase: string;
  address?: string;
}

export interface WalletConnector {
  connect(): Promise<{ address: string }>;
  signTransaction?: (xdr: string, opts: SignTransactionOpts) => Promise<{ signedXdr: string }>;
  /**
   * Signs an arbitrary UTF-8 message (not a Stellar XDR envelope) and returns
   * a base64-encoded ed25519 signature over it. Used for the presentation
   * holder proof (#40) — `signTransaction` cannot be used there because a
   * presentation digest is not a transaction envelope and wallets will refuse
   * or mis-sign it.
   */
  signMessage?: (message: string, opts: SignTransactionOpts) => Promise<{ signedMessage: string }>;
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

/**
 * Fixed, non-secret dev/CI keypair. Its address is what `connect()` returns
 * as the holder, and its secret is what `signMessage()` signs with — kept in
 * sync deliberately so a presentation shared through the mock connector
 * produces a proof that `verifyPresentationProof` can actually validate,
 * exercising the "signed" state locally without a real wallet extension.
 * Never use this seed for anything beyond local dev/CI.
 */
const MOCK_KEYPAIR = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));
const MOCK_ADDRESS = MOCK_KEYPAIR.publicKey();

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

  /**
   * Deterministically "signs" the message with a fixed local keypair,
   * following the same SEP-0053 preimage a real wallet's `signMessage` signs
   * (`SHA-256("Stellar Signed Message:\n" + message)`, not the raw message
   * bytes) — so the mock connector still produces a proof that
   * `verifyPresentationProof` validates in dev/CI without a real wallet
   * extension.
   */
  async signMessage(message: string): Promise<{ signedMessage: string }> {
    const hash = await sep0053MessageHash(message);
    const signature = MOCK_KEYPAIR.sign(Buffer.from(hash));
    return { signedMessage: signature.toString('base64') };
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

  async signMessage(
    message: string,
    opts: SignTransactionOpts
  ): Promise<{ signedMessage: string }> {
    try {
      const { signedMessage } = await StellarWalletsKit.signMessage(message, {
        networkPassphrase: opts.networkPassphrase ?? this.networkPassphrase,
        address: opts.address,
      });
      return { signedMessage };
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
  // The mock connector's keypair is fixed and public (see MOCK_KEYPAIR above)
  // — anyone can reproduce a "valid" proof for it. It must never be reachable
  // outside development/test, regardless of how NEXT_PUBLIC_WALLET ends up
  // unset or misconfigured in a deployed environment.
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error(
      'NEXT_PUBLIC_WALLET must be set to "real" outside development/test — the mock wallet is not safe to serve in this environment.'
    );
  }
  return new MockWalletConnector();
}