/**
 * @fileoverview Server-side persistence and resolution of shared presentations.
 *
 * This module must only ever be imported from Route Handlers / Server
 * Components. It is what makes a share link tamper-evident:
 *
 *   - the link carries an opaque 256-bit random reference, not the payload, so
 *     it can be neither decoded into credential data nor edited;
 *   - the presentation (credential ids + expiration + holder proof) lives
 *     here, out of the verifier's reach;
 *   - expiration is enforced on resolution, so extending a link is impossible
 *     without asking the holder for a new one.
 *
 * SEAM: `InMemoryPresentationStore` is process-local — it does not survive a
 * restart and is not shared between serverless instances. It implements the
 * `PresentationStore` contract from `@acta-products/acta/presentation`;
 * swapping it for an ACTA off-chain payload (or any durable KV) is a one-line
 * change in `getPresentationStore()` and touches nothing else.
 */

import {
  buildPresentation,
  InvalidPresentationError,
  isPresentationExpired,
  presentationExpiresAt,
  type PresentationProof,
  type PresentationStore,
  type VerifiablePresentation,
} from '@acta-products/acta/presentation';

/** 32 random bytes → 43 base64url chars. */
const REF_BYTES = 32;
const REF_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createPresentationRef(): string {
  const bytes = new Uint8Array(REF_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isPresentationRef(value: unknown): value is string {
  return typeof value === 'string' && REF_PATTERN.test(value);
}

// ─── In-memory store ──────────────────────────────────────────────────────────

/**
 * Held on `globalThis` so the map survives Next.js dev hot-reloads, which
 * re-evaluate this module on every edit and would otherwise drop every link
 * generated since the last save.
 */
const GLOBAL_KEY = Symbol.for('acta:presentation-store');

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, VerifiablePresentation>;
};

function records(): Map<string, VerifiablePresentation> {
  const scope = globalThis as GlobalWithStore;
  scope[GLOBAL_KEY] ??= new Map<string, VerifiablePresentation>();
  return scope[GLOBAL_KEY];
}

class InMemoryPresentationStore implements PresentationStore {
  async save(ref: string, presentation: VerifiablePresentation): Promise<void> {
    records().set(ref, presentation);
  }

  async get(ref: string): Promise<VerifiablePresentation | null> {
    return records().get(ref) ?? null;
  }

  async delete(ref: string): Promise<void> {
    records().delete(ref);
  }
}

let store: PresentationStore | null = null;

export function getPresentationStore(): PresentationStore {
  store ??= new InMemoryPresentationStore();
  return store;
}

/** Test seam — lets a test swap in its own store implementation. */
export function setPresentationStore(next: PresentationStore | null): void {
  store = next;
}

// ─── Create / resolve ─────────────────────────────────────────────────────────

export interface CreatePresentationInput {
  holder: string;
  credentialIds: string[];
  expiresAt: number | null;
  /**
   * Creation time supplied by the holder so the server rebuilds the exact
   * object that was signed. Rejected when it drifts more than
   * `MAX_CREATED_AT_DRIFT_MS` from the server clock, so it can't be used to
   * backdate or postdate a presentation.
   */
  createdAt?: number;
  proof?: PresentationProof;
}

/** Tolerance for the holder-supplied `createdAt` against the server clock. */
export const MAX_CREATED_AT_DRIFT_MS = 5 * 60 * 1000;

export interface CreatedPresentation {
  ref: string;
  presentation: VerifiablePresentation;
}

/**
 * Build, sign-wrap and persist a presentation.
 *
 * Throws `InvalidPresentationError` when the input is malformed — callers
 * should map that to a 400.
 */
export async function createStoredPresentation({
  holder,
  credentialIds,
  expiresAt,
  createdAt,
  proof,
}: CreatePresentationInput): Promise<CreatedPresentation> {
  const now = Date.now();

  if (createdAt !== undefined && Math.abs(now - createdAt) > MAX_CREATED_AT_DRIFT_MS) {
    throw new InvalidPresentationError('createdAt is too far from the server clock.');
  }

  const built = buildPresentation({
    holder,
    credentialIds,
    expiresAt,
    createdAt: createdAt ?? now,
  });
  const presentation = proof ? { ...built, proof } : built;

  const ref = createPresentationRef();
  await getPresentationStore().save(ref, presentation);

  return { ref, presentation };
}

export type PresentationResolution =
  | { status: 'ok'; presentation: VerifiablePresentation }
  | { status: 'not_found' }
  | { status: 'expired'; expiresAt: number };

/**
 * Resolve a share reference, enforcing expiration here rather than trusting
 * the client. Expired presentations are dropped from the store on the way out
 * so the reference stops resolving for good.
 */
export async function resolveStoredPresentation(ref: unknown): Promise<PresentationResolution> {
  if (!isPresentationRef(ref)) {
    return { status: 'not_found' };
  }

  const activeStore = getPresentationStore();
  const presentation = await activeStore.get(ref);

  if (!presentation) {
    return { status: 'not_found' };
  }

  if (isPresentationExpired(presentation)) {
    await activeStore.delete(ref);
    return { status: 'expired', expiresAt: presentationExpiresAt(presentation) ?? 0 };
  }

  return { status: 'ok', presentation };
}
