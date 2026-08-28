import { Keypair } from '@stellar/stellar-sdk';
import { parseDidStellar } from './did';

/** W3C VC Data Model v2 context, the same one `vcIssue` requires for vcData. */
export const PRESENTATION_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

export const PRESENTATION_TYPE = 'VerifiablePresentation';

/**
 * Holder proof over the canonical presentation payload.
 *
 * `signature` is produced by the connected wallet (Freighter / Stellar Wallets
 * Kit) via its arbitrary-message signing primitive (`signMessage`, not
 * `signTransaction` — the digest is not a Stellar XDR envelope). It is stored
 * alongside the presentation and surfaced to the verifier; cryptographic
 * validation against the holder's `did:stellar` key is `verifyPresentationProof`
 * below, exercised by `/api/presentations/[ref]` as part of the public
 * verification flow (#40).
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

/**
 * SEP-0053 preimage prefix. Fixed by the spec — never change this.
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
 */
const SEP0053_PREFIX = 'Stellar Signed Message:\n';

/**
 * The exact digest a SEP-0053-compliant `signMessage` implementation signs:
 * `SHA-256("Stellar Signed Message:\n" + message)`, UTF-8 throughout. This is
 * NOT the same as hashing `message` alone — the fixed prefix is what makes a
 * signed message unambiguously distinct from a signed transaction envelope
 * and prevents cross-protocol replay, per the SEP's own rationale.
 *
 * Uses Web Crypto (`globalThis.crypto.subtle`) rather than Node's `crypto`
 * module so this stays isomorphic — `presentationDigest` above already
 * depends on the same API, and this function needs to be callable from
 * `signPresentation` on the client as well as `verifyPresentationProof` on
 * the server.
 */
export async function sep0053MessageHash(message: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(SEP0053_PREFIX + message);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash);
}

/**
 * Result of checking a presentation's holder proof.
 *
 * `unsigned` and `mismatch` are deliberately distinct: `unsigned` means the
 * holder never attempted (or could not produce) a proof — the presentation is
 * still a legitimate, tamper-evident link. `mismatch` means a proof is
 * present but fails verification, which is the state a verifier should treat
 * with suspicion.
 */
export type ProofVerification =
  | { status: 'signed' }
  | { status: 'unsigned' }
  | { status: 'mismatch'; reason: 'digest' | 'signature' | 'holder' | 'malformed' };

/** Sane upper bound on proof field lengths, shared with API-side validation. */
const MAX_PROOF_FIELD_LENGTH = 4096;

function isWellFormedProof(proof: PresentationProof): boolean {
  return (
    typeof proof.digest === 'string' &&
    typeof proof.signature === 'string' &&
    typeof proof.verificationMethod === 'string' &&
    proof.digest.length > 0 &&
    proof.digest.length <= MAX_PROOF_FIELD_LENGTH &&
    proof.signature.length > 0 &&
    proof.signature.length <= MAX_PROOF_FIELD_LENGTH &&
    proof.verificationMethod.length > 0 &&
    proof.verificationMethod.length <= MAX_PROOF_FIELD_LENGTH
  );
}

/**
 * Cryptographically verify a presentation's holder proof, in the order the
 * threat model requires:
 *
 *   1. Recompute the digest from the (proof-excluded) canonical payload and
 *      compare it to `proof.digest` — catches any edit to the presentation
 *      after it was signed, including a tampered `verifiableCredential` list
 *      or `expires` value.
 *   2. Check `proof.verificationMethod === presentation.holder` — the proof
 *      must claim to speak for the same identity the presentation is shared
 *      under, not some other key.
 *   3. Decode the ed25519 public key from the holder's `did:stellar` and
 *      verify `signature` over `digest` with it.
 *
 * Must run server-side: `Keypair.verify` takes Node `Buffer`s, and this
 * function is not meant to ship into the public verifier's client bundle.
 */
export async function verifyPresentationProof(
  presentation: VerifiablePresentation
): Promise<ProofVerification> {
  const { proof } = presentation;

  if (!proof) {
    return { status: 'unsigned' };
  }

  if (!isWellFormedProof(proof)) {
    return { status: 'mismatch', reason: 'malformed' };
  }

  const expectedDigest = await presentationDigest(presentation);
  if (proof.digest !== expectedDigest) {
    return { status: 'mismatch', reason: 'digest' };
  }

  if (proof.verificationMethod !== presentation.holder) {
    return { status: 'mismatch', reason: 'holder' };
  }

  const parsedHolder = parseDidStellar(presentation.holder);
  if (!parsedHolder) {
    return { status: 'mismatch', reason: 'malformed' };
  }

  let verified: boolean;
  try {
    const keypair = Keypair.fromPublicKey(parsedHolder.address);
    // What the wallet actually signed is the SEP-0053 preimage of the
    // digest string — not the digest's raw UTF-8 bytes. See the file-level
    // note above.
    const messageHash = await sep0053MessageHash(proof.digest);
    const signature = Buffer.from(proof.signature, 'base64');
    verified = signature.length > 0 && keypair.verify(Buffer.from(messageHash), signature);
  } catch {
    // A malformed G… address (bad checksum/length) or non-base64 signature
    // lands here — it can never verify, so it's a mismatch, not a crash.
    return { status: 'mismatch', reason: 'malformed' };
  }

  return verified ? { status: 'signed' } : { status: 'mismatch', reason: 'signature' };
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
 * A stored presentation plus the link-management metadata (#57) that must
 * not live on `VerifiablePresentation` itself — that shape is the W3C
 * presentation and stays clean for anything that consumes it downstream
 * (the verifier, the digest, the proof).
 */
export interface StoredPresentationRecord {
  ref: string;
  presentation: VerifiablePresentation;
  /** Duplicated from `presentation.holder` so drivers can index/query by it. */
  holder: string;
  /** Epoch milliseconds. Duplicated from `presentation.created`. */
  createdAt: number;
  /** Epoch milliseconds, or null for a link that never expires. */
  expiresAt: number | null;
  /** Epoch milliseconds the holder revoked the link, or null. */
  revokedAt: number | null;
}

/**
 * Persistence seam for presentations. Implementations must treat `ref` as an
 * opaque, unguessable capability — never derive it from the presentation
 * contents.
 */
export interface PresentationStore {
  save(ref: string, record: StoredPresentationRecord): Promise<void>;
  get(ref: string): Promise<StoredPresentationRecord | null>;
  delete(ref: string): Promise<void>;
  /** Every non-deleted record for a holder — listing (#57) filters/enforces expiry itself. */
  listByHolder(holder: string): Promise<StoredPresentationRecord[]>;
}

/**
 * Verify a wallet signature over an arbitrary action message (link revocation,
 * link listing) — the same SEP-0053 `signMessage` primitive and preimage as
 * `verifyPresentationProof`, just over a caller-chosen message instead of a
 * presentation digest. Used to prove control of the holder key for actions
 * that are not "sharing a presentation" (see `/api/presentations` DELETE and
 * the holder-scoped GET in #57).
 */
export interface HolderActionProof {
  /** DID claiming to have produced the signature — must equal the resource's holder. */
  holder: string;
  /** base64 wallet signature over the SEP-0053 hash of `message`. */
  signature: string;
}

export async function verifyHolderActionProof(
  message: string,
  proof: HolderActionProof
): Promise<boolean> {
  if (!proof.signature) return false;

  const parsedHolder = parseDidStellar(proof.holder);
  if (!parsedHolder) return false;

  try {
    const keypair = Keypair.fromPublicKey(parsedHolder.address);
    const messageHash = await sep0053MessageHash(message);
    const signature = Buffer.from(proof.signature, 'base64');
    return signature.length > 0 && keypair.verify(Buffer.from(messageHash), signature);
  } catch {
    // A malformed G… address or non-base64 signature can never verify.
    return false;
  }
}
