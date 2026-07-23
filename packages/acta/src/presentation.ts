/**
 * @fileoverview Verifiable Presentation model for ACTA share links.
 *
 * Replaces the plaintext base64url token that used to carry `{ ids, exp }` in
 * the URL. A presentation is now a W3C-shaped object built here, signed by the
 * holder (see `attachPresentationProof`) and persisted server-side; the share
 * URL only carries an opaque reference to it.
 *
 * The presentation deliberately references credentials by id only — the claims
 * themselves are never part of the shared object. The resolving side re-reads
 * them from the holder's ACTA vault, so a share link can never leak credential
 * data on its own.
 *
 * NOTE ON PERSISTENCE:
 * `@acta-team/credentials` exposes its client exclusively through the
 * `useActaClient()` React hook, so it cannot be constructed on a server
 * runtime. Persistence therefore lives behind the `PresentationStore`
 * interface below; the product wires the concrete store (see
 * `apps/credit-history/src/lib/presentation-store.ts`). When the SDK exposes a
 * non-hook client or a dedicated off-chain payload endpoint, swap the store
 * implementation — nothing else in this file changes.
 */

/** W3C VC Data Model v2 context, the same one `vcIssue` requires for vcData. */
export const PRESENTATION_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

export const PRESENTATION_TYPE = 'VerifiablePresentation';

/**
 * Holder proof over the canonical presentation payload.
 *
 * `signature` is produced by the connected wallet (Freighter / Stellar Wallets
 * Kit). It is stored alongside the presentation and surfaced to the verifier;
 * cryptographic validation of the signature against the holder's did:stellar
 * key belongs to the public verification flow (#40).
 */
export interface PresentationProof {
  type: 'StellarWalletSignature2026';
  /** ISO timestamp of when the proof was created. */
  created: string;
  /** DID whose key produced the signature — always the holder DID. */
  verificationMethod: string;
  /** base64url SHA-256 digest of the canonical presentation payload. */
  digest: string;
  /** Wallet-produced signature over `digest`. */
  signature: string;
}

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  /** Holder DID in did:stellar:{network}:{G…} form. */
  holder: string;
  /** ACTA vault credential ids included in this presentation. */
  verifiableCredential: string[];
  /** ISO timestamp of creation. */
  created: string;
  /** ISO timestamp after which the presentation must be rejected, or null. */
  expires: string | null;
  proof?: PresentationProof;
}

export interface BuildPresentationInput {
  /** Holder DID (did:stellar:…). */
  holder: string;
  /** Credential ids selected by the holder. */
  credentialIds: string[];
  /** Expiration as epoch milliseconds, or null for a link that never expires. */
  expiresAt: number | null;
  /** Creation time as epoch milliseconds. Defaults to now. */
  createdAt?: number;
}

export class InvalidPresentationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPresentationError';
  }
}

/** Maximum number of credentials a single presentation may reference. */
export const MAX_PRESENTATION_CREDENTIALS = 64;

export function buildPresentation({
  holder,
  credentialIds,
  expiresAt,
  createdAt = Date.now(),
}: BuildPresentationInput): VerifiablePresentation {
  if (typeof holder !== 'string' || holder.length === 0) {
    throw new InvalidPresentationError('A holder DID is required to build a presentation.');
  }

  if (!Array.isArray(credentialIds) || credentialIds.length === 0) {
    throw new InvalidPresentationError('A presentation must reference at least one credential.');
  }

  if (credentialIds.length > MAX_PRESENTATION_CREDENTIALS) {
    throw new InvalidPresentationError(
      `A presentation may reference at most ${MAX_PRESENTATION_CREDENTIALS} credentials.`
    );
  }

  if (credentialIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new InvalidPresentationError('Credential ids must be non-empty strings.');
  }

  if (expiresAt !== null) {
    if (!Number.isFinite(expiresAt)) {
      throw new InvalidPresentationError('Expiration must be a finite timestamp or null.');
    }
    if (expiresAt <= createdAt) {
      throw new InvalidPresentationError('Expiration must be in the future.');
    }
  }

  // Deduplicate while preserving the holder's selection order.
  const ids = [...new Set(credentialIds)];

  return {
    '@context': [PRESENTATION_CONTEXT],
    type: [PRESENTATION_TYPE],
    holder,
    verifiableCredential: ids,
    created: new Date(createdAt).toISOString(),
    expires: expiresAt === null ? null : new Date(expiresAt).toISOString(),
  };
}

/**
 * Deterministic JSON serialisation used as the signing payload.
 *
 * Object keys are sorted recursively and `proof` is excluded, so the digest is
 * stable regardless of property insertion order and can be recomputed by a
 * verifier from the stored presentation.
 */
export function canonicalPresentationPayload(presentation: VerifiablePresentation): string {
  const { proof: _proof, ...unsigned } = presentation;
  return stableStringify(unsigned);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);

  return `{${entries.join(',')}}`;
}

/** base64url SHA-256 of the canonical payload. Works in browser and Node 22+. */
export async function presentationDigest(presentation: VerifiablePresentation): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalPresentationPayload(presentation));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return base64UrlEncode(new Uint8Array(hash));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function attachPresentationProof(
  presentation: VerifiablePresentation,
  proof: PresentationProof
): VerifiablePresentation {
  return { ...presentation, proof };
}

/** Expiration as epoch milliseconds, or null when the presentation never expires. */
export function presentationExpiresAt(presentation: VerifiablePresentation): number | null {
  if (presentation.expires === null) return null;
  const parsed = Date.parse(presentation.expires);
  // An unparseable expiry is treated as "already expired" rather than "never".
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isPresentationExpired(
  presentation: VerifiablePresentation,
  now: number = Date.now()
): boolean {
  const expiresAt = presentationExpiresAt(presentation);
  return expiresAt !== null && now > expiresAt;
}

/**
 * Persistence seam for presentations. Implementations must treat `ref` as an
 * opaque, unguessable capability — never derive it from the presentation
 * contents.
 */
export interface PresentationStore {
  save(ref: string, presentation: VerifiablePresentation): Promise<void>;
  get(ref: string): Promise<VerifiablePresentation | null>;
  delete(ref: string): Promise<void>;
}
