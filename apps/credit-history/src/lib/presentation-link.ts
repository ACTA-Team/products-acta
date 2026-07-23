/**
 * @fileoverview Client-side helpers for the share (#39) and verify (#40) flows.
 *
 * Replaces the old `presentation-token` codec: nothing is encoded into the URL
 * any more. `createPresentationLink` asks the server to persist a presentation
 * and returns the opaque reference; `resolvePresentationRef` exchanges that
 * reference back for the presentation, with expiration decided server-side.
 */

import {
  buildPresentation,
  presentationDigest,
  type PresentationProof,
  type VerifiablePresentation,
} from '@acta-products/acta/presentation';
import type { SignTransactionOpts, WalletConnector } from '@/session/wallet-connector';

const API_ROOT = '/api/presentations';

export interface CreatePresentationLinkInput {
  holder: string;
  credentialIds: string[];
  /** Epoch milliseconds, or null for a link that never expires. */
  expiresAt: number | null;
  /**
   * Creation time in epoch milliseconds. Sent explicitly so the server rebuilds
   * byte-identical presentation to the one the holder signed — otherwise the
   * two `created` timestamps differ and the proof digest no longer matches.
   * The server rejects values that are not close to its own clock.
   */
  createdAt: number;
  proof?: PresentationProof;
}

export interface CreatedPresentationLink {
  ref: string;
  /** Absolute URL the holder shares with a verifier. */
  url: string;
  expiresAt: number | null;
}

export class PresentationLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresentationLinkError';
  }
}

export async function createPresentationLink(
  input: CreatePresentationLinkInput,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): Promise<CreatedPresentationLink> {
  const response = await fetch(API_ROOT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);
    throw new PresentationLinkError(detail ?? 'The presentation could not be created.');
  }

  const { ref, expiresAt } = (await response.json()) as { ref: string; expiresAt: number | null };

  return { ref, url: `${origin}/verify/${ref}`, expiresAt };
}

export type PresentationResolution =
  | { status: 'ok'; presentation: VerifiablePresentation }
  | { status: 'not_found' }
  | { status: 'expired'; expiresAt: number };

export async function resolvePresentationRef(ref: string): Promise<PresentationResolution> {
  let response: Response;

  try {
    response = await fetch(`${API_ROOT}/${encodeURIComponent(ref)}`, { cache: 'no-store' });
  } catch {
    // A network failure is indistinguishable from an unknown reference for the
    // verifier's purposes — both mean "this link cannot be trusted right now".
    return { status: 'not_found' };
  }

  if (response.status === 410) {
    const body = (await response.json().catch(() => ({}))) as { expiresAt?: number };
    return { status: 'expired', expiresAt: body.expiresAt ?? 0 };
  }

  if (!response.ok) {
    return { status: 'not_found' };
  }

  const { presentation } = (await response.json()) as { presentation: VerifiablePresentation };
  return { status: 'ok', presentation };
}

// ─── Holder proof ─────────────────────────────────────────────────────────────

/**
 * Ask the connected wallet to sign the digest of the presentation about to be
 * created.
 *
 * Best-effort by design: `signTransaction` expects a Stellar XDR envelope, and
 * neither the mock connector nor every real wallet will sign a bare digest. A
 * refusal must not block sharing, so failures resolve to `null` and the
 * presentation is persisted unsigned — the opaque reference is what makes the
 * link tamper-evident, the proof is the extra attribution layer the public
 * verifier (#40) will validate against the holder's did:stellar key.
 */
export async function signPresentation(
  connector: WalletConnector,
  input: { holder: string; credentialIds: string[]; expiresAt: number | null; createdAt: number },
  opts: SignTransactionOpts
): Promise<PresentationProof | null> {
  if (!connector.signTransaction) return null;

  try {
    const presentation = buildPresentation(input);
    const digest = await presentationDigest(presentation);
    const { signedXdr } = await connector.signTransaction(digest, opts);

    if (!signedXdr) return null;

    return {
      type: 'StellarWalletSignature2026',
      created: new Date().toISOString(),
      verificationMethod: input.holder,
      digest,
      signature: signedXdr,
    };
  } catch (err) {
    console.warn('Holder proof skipped — the wallet could not sign the presentation digest.', err);
    return null;
  }
}
