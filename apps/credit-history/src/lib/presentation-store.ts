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
 * Driver selection (#57): `getPresentationStore()` picks the backing driver
 * from `PRESENTATION_STORE_DRIVER` — `memory` (default, keeps `pnpm dev`
 * zero-config) or `upstash-redis` (durable, survives restarts/redeploys and
 * is shared across serverless instances). Every other module in this app
 * talks to the store only through the `PresentationStore` contract, so
 * swapping drivers touches nothing else.
 *
 * Revocation authorisation (#57): a holder revokes a link, or lists their own
 * links, by signing an action message with their wallet
 * (`verifyHolderActionProof`, the same SEP-0053 primitive as the presentation
 * proof) over a message that embeds a timestamp. The server checks the
 * signature against the record's `holder` DID and rejects a stale timestamp —
 * knowing a DID is never sufficient on its own, only a working wallet key is.
 */

import {
  buildPresentation,
  InvalidPresentationError,
  verifyHolderActionProof,
  type HolderActionProof,
  type PresentationProof,
  type PresentationStore,
  type StoredPresentationRecord,
  type VerifiablePresentation,
} from '@acta-products/acta/presentation';
import { getRedisPresentationStore } from './presentation-store-redis';

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
  [GLOBAL_KEY]?: Map<string, StoredPresentationRecord>;
};

function records(): Map<string, StoredPresentationRecord> {
  const scope = globalThis as GlobalWithStore;
  scope[GLOBAL_KEY] ??= new Map<string, StoredPresentationRecord>();
  return scope[GLOBAL_KEY];
}

class InMemoryPresentationStore implements PresentationStore {
  async save(ref: string, record: StoredPresentationRecord): Promise<void> {
    records().set(ref, record);
  }

  async get(ref: string): Promise<StoredPresentationRecord | null> {
    return records().get(ref) ?? null;
  }

  async delete(ref: string): Promise<void> {
    records().delete(ref);
  }

  async listByHolder(holder: string): Promise<StoredPresentationRecord[]> {
    const now = Date.now();
    const own = [...records().values()].filter((record) => record.holder === holder);

    // Expired rows self-clean on the way out rather than accumulating forever.
    for (const record of own) {
      if (record.expiresAt !== null && now > record.expiresAt) {
        records().delete(record.ref);
      }
    }

    return own.filter((record) => record.expiresAt === null || now <= record.expiresAt);
  }
}

// ─── Driver selection ─────────────────────────────────────────────────────────

let store: PresentationStore | null = null;

/**
 * Chosen once, by `PRESENTATION_STORE_DRIVER`, and cached for the life of the
 * process/lambda. This is the only place that knows which driver is active.
 */
export function getPresentationStore(): PresentationStore {
  if (store) return store;

  const driver = process.env.PRESENTATION_STORE_DRIVER ?? 'memory';

  switch (driver) {
    case 'upstash-redis':
      store = getRedisPresentationStore();
      break;
    case 'memory':
      store = new InMemoryPresentationStore();
      break;
    default:
      throw new Error(
        `Unknown PRESENTATION_STORE_DRIVER "${driver}". Expected "memory" or "upstash-redis".`
      );
  }

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

/** Tolerance for the holder-supplied `createdAt`, and for action-proof timestamps. */
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

  const resolvedCreatedAt = createdAt ?? now;
  const built = buildPresentation({
    holder,
    credentialIds,
    expiresAt,
    createdAt: resolvedCreatedAt,
  });
  const presentation = proof ? { ...built, proof } : built;

  const ref = createPresentationRef();
  await getPresentationStore().save(ref, {
    ref,
    presentation,
    holder,
    createdAt: resolvedCreatedAt,
    expiresAt,
    revokedAt: null,
  });

  return { ref, presentation };
}

export type PresentationResolution =
  | { status: 'ok'; presentation: VerifiablePresentation }
  | { status: 'not_found' }
  | { status: 'expired'; expiresAt: number }
  | { status: 'revoked'; revokedAt: number };

/**
 * Resolve a share reference, enforcing expiration here rather than trusting
 * the client. Expired presentations are dropped from the store on the way out
 * so the reference stops resolving for good. A revoked reference is left in
 * the store (until it naturally expires) so it keeps showing up, revoked, in
 * the holder's own listing.
 */
export async function resolveStoredPresentation(ref: unknown): Promise<PresentationResolution> {
  if (!isPresentationRef(ref)) {
    return { status: 'not_found' };
  }

  const activeStore = getPresentationStore();
  const record = await activeStore.get(ref);

  if (!record) {
    return { status: 'not_found' };
  }

  if (record.expiresAt !== null && Date.now() > record.expiresAt) {
    await activeStore.delete(ref);
    return { status: 'expired', expiresAt: record.expiresAt };
  }

  if (record.revokedAt !== null) {
    return { status: 'revoked', revokedAt: record.revokedAt };
  }

  return { status: 'ok', presentation: record.presentation };
}

// ─── Holder link management (#57) ────────────────────────────────────────────

export interface SharedLinkSummary {
  ref: string;
  credentialCount: number;
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
}

function toSummary(record: StoredPresentationRecord): SharedLinkSummary {
  return {
    ref: record.ref,
    credentialCount: record.presentation.verifiableCredential.length,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
  };
}

/**
 * Builds the exact message a holder's wallet must sign to prove control over
 * `holder` for a link-management action. Embeds `timestamp` so a captured
 * signature can't be replayed after `MAX_CREATED_AT_DRIFT_MS`.
 */
export function holderActionMessage(
  action: 'list' | 'revoke',
  holder: string,
  timestamp: number,
  ref?: string
): string {
  return action === 'revoke'
    ? `ACTA:presentations:revoke:${ref}:${holder}:${timestamp}`
    : `ACTA:presentations:list:${holder}:${timestamp}`;
}

export type HolderAuthResult = { ok: true } | { ok: false; reason: 'stale' | 'invalid' };

async function verifyHolderAuth(
  action: 'list' | 'revoke',
  holder: string,
  timestamp: number,
  proof: HolderActionProof,
  ref?: string
): Promise<HolderAuthResult> {
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > MAX_CREATED_AT_DRIFT_MS) {
    return { ok: false, reason: 'stale' };
  }

  if (proof.holder !== holder) {
    return { ok: false, reason: 'invalid' };
  }

  const message = holderActionMessage(action, holder, timestamp, ref);
  const verified = await verifyHolderActionProof(message, proof);
  return verified ? { ok: true } : { ok: false, reason: 'invalid' };
}

export type ListLinksResult =
  | { ok: true; links: SharedLinkSummary[] }
  | { ok: false; reason: 'stale' | 'invalid' };

/** `GET /api/presentations?holder=` — lists a holder's own non-expired links. */
export async function listStoredPresentations(
  holder: string,
  timestamp: number,
  proof: HolderActionProof
): Promise<ListLinksResult> {
  const auth = await verifyHolderAuth('list', holder, timestamp, proof);
  if (!auth.ok) return auth;

  const records = await getPresentationStore().listByHolder(holder);
  return { ok: true, links: records.map(toSummary) };
}

export type RevokeLinkResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale' | 'invalid' };

/**
 * `DELETE /api/presentations/[ref]` — revokes a link on behalf of its holder.
 * Idempotent: revoking an already-revoked link the same holder controls
 * succeeds without error.
 */
export async function revokeStoredPresentation(
  ref: string,
  holder: string,
  timestamp: number,
  proof: HolderActionProof
): Promise<RevokeLinkResult> {
  // Checked before touching the store: a caller who cannot prove they are
  // `holder` must not learn whether `ref` exists at all.
  const auth = await verifyHolderAuth('revoke', holder, timestamp, proof, ref);
  if (!auth.ok) return auth;

  const activeStore = getPresentationStore();
  const record = await activeStore.get(ref);
  if (!record) return { ok: false, reason: 'not_found' };

  if (record.holder !== holder) {
    // The signature checked out for `holder`, but this link belongs to
    // someone else — never leak whether the ref exists to the wrong holder.
    return { ok: false, reason: 'not_found' };
  }

  if (record.revokedAt === null) {
    await activeStore.save(ref, { ...record, revokedAt: Date.now() });
  }

  return { ok: true };
}
