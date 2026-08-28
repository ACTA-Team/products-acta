/**
 * @vitest-environment node
 *
 * The revoke/list flows sign with real ed25519 keys via `@stellar/stellar-sdk`,
 * which needs real Node crypto — see the same note in
 * `app/api/presentations/route.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { didStellar } from '@acta-products/acta/did';
import {
  InvalidPresentationError,
  sep0053MessageHash,
  type HolderActionProof,
} from '@acta-products/acta/presentation';
import {
  createPresentationRef,
  createStoredPresentation,
  holderActionMessage,
  isPresentationRef,
  listStoredPresentations,
  MAX_CREATED_AT_DRIFT_MS,
  resolveStoredPresentation,
  revokeStoredPresentation,
  setPresentationStore,
} from './presentation-store';

const HOLDER = 'did:stellar:testnet:GHOLDER';

const holderKeypair = Keypair.random();
const REAL_HOLDER = didStellar('testnet', holderKeypair.publicKey());

async function signAction(
  action: 'list' | 'revoke',
  timestamp: number,
  ref?: string,
  signer: Keypair = holderKeypair
): Promise<HolderActionProof> {
  const message = holderActionMessage(action, REAL_HOLDER, timestamp, ref);
  const hash = await sep0053MessageHash(message);
  return {
    holder: REAL_HOLDER,
    signature: signer.sign(Buffer.from(hash)).toString('base64'),
  };
}

beforeEach(() => {
  setPresentationStore(null);
});

afterEach(() => {
  setPresentationStore(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createPresentationRef', () => {
  it('produces an opaque 43-char base64url reference', () => {
    const ref = createPresentationRef();
    expect(ref).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isPresentationRef(ref)).toBe(true);
  });

  it('never repeats a reference', () => {
    const refs = new Set(Array.from({ length: 200 }, createPresentationRef));
    expect(refs.size).toBe(200);
  });

  it.each(['', 'short', 'not-a-ref!!', 'a'.repeat(44)])('rejects %o as a reference', (value) => {
    expect(isPresentationRef(value)).toBe(false);
  });
});

describe('createStoredPresentation', () => {
  it('returns a reference that leaks nothing about the presentation', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-income', 'cred-loan'],
      expiresAt: Date.now() + 3_600_000,
    });

    expect(ref).not.toContain('cred-income');
    expect(atob(ref.replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('cred');
  });

  it('rejects a createdAt that drifts from the server clock', async () => {
    await expect(
      createStoredPresentation({
        holder: HOLDER,
        credentialIds: ['cred-income'],
        expiresAt: null,
        createdAt: Date.now() - MAX_CREATED_AT_DRIFT_MS - 1,
      })
    ).rejects.toBeInstanceOf(InvalidPresentationError);
  });

  it('rejects an empty selection', async () => {
    await expect(
      createStoredPresentation({ holder: HOLDER, credentialIds: [], expiresAt: null })
    ).rejects.toBeInstanceOf(InvalidPresentationError);
  });
});

describe('resolveStoredPresentation', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('resolves a live reference to its presentation', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: Date.now() + 3_600_000,
    });

    const resolution = await resolveStoredPresentation(ref);
    expect(resolution.status).toBe('ok');
    if (resolution.status !== 'ok') return;
    expect(resolution.presentation.holder).toBe(HOLDER);
    expect(resolution.presentation.verifiableCredential).toEqual(['cred-income']);
  });

  it('reports an unknown or malformed reference as not_found', async () => {
    expect((await resolveStoredPresentation(createPresentationRef())).status).toBe('not_found');
    expect((await resolveStoredPresentation('tampered')).status).toBe('not_found');
    expect((await resolveStoredPresentation(undefined)).status).toBe('not_found');
  });

  it('enforces expiration on resolution and burns the reference', async () => {
    const expiresAt = Date.now() + 60_000;
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-income'],
      expiresAt,
    });

    expect((await resolveStoredPresentation(ref)).status).toBe('ok');

    vi.useFakeTimers();
    vi.setSystemTime(expiresAt + 1);

    const expired = await resolveStoredPresentation(ref);
    expect(expired).toEqual({ status: 'expired', expiresAt });

    // Once expired the reference stops resolving even if the clock moves back.
    vi.setSystemTime(expiresAt - 10_000);
    expect((await resolveStoredPresentation(ref)).status).toBe('not_found');
  });

  it('keeps resolving a presentation that never expires', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 365 * 24 * 60 * 60 * 1000);

    expect((await resolveStoredPresentation(ref)).status).toBe('ok');
  });

  it('survives a simulated process restart against the same backing store', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    // Drops the cached driver instance — the next call to getPresentationStore()
    // re-instantiates the driver from scratch, the way a fresh lambda cold
    // start or a redeploy would, without wiping the backing data itself.
    setPresentationStore(null);

    expect((await resolveStoredPresentation(ref)).status).toBe('ok');
  });
});

describe('revokeStoredPresentation', () => {
  it("revokes a link with the holder's proof and stops it resolving", async () => {
    const { ref } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    const timestamp = Date.now();
    const proof = await signAction('revoke', timestamp, ref);

    const result = await revokeStoredPresentation(ref, REAL_HOLDER, timestamp, proof);
    expect(result).toEqual({ ok: true });

    const resolution = await resolveStoredPresentation(ref);
    expect(resolution.status).toBe('revoked');
  });

  it('is idempotent when revoking an already-revoked link', async () => {
    const { ref } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    const first = Date.now();
    await revokeStoredPresentation(ref, REAL_HOLDER, first, await signAction('revoke', first, ref));

    const second = first + 1000;
    const result = await revokeStoredPresentation(
      ref,
      REAL_HOLDER,
      second,
      await signAction('revoke', second, ref)
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects (invalid) a signature from a different keypair', async () => {
    const { ref } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    const timestamp = Date.now();
    const proof = await signAction('revoke', timestamp, ref, Keypair.random());

    const result = await revokeStoredPresentation(ref, REAL_HOLDER, timestamp, proof);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect((await resolveStoredPresentation(ref)).status).toBe('ok');
  });

  it('rejects (stale) a replayed, old timestamp', async () => {
    const { ref } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    const timestamp = Date.now() - MAX_CREATED_AT_DRIFT_MS - 1;
    const proof = await signAction('revoke', timestamp, ref);

    const result = await revokeStoredPresentation(ref, REAL_HOLDER, timestamp, proof);
    expect(result).toEqual({ ok: false, reason: 'stale' });
  });

  it('reports not_found for an unknown ref, without leaking whether it exists to the wrong holder', async () => {
    const otherHolderKeypair = Keypair.random();
    const otherHolder = didStellar('testnet', otherHolderKeypair.publicKey());

    const { ref } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-income'],
      expiresAt: null,
    });

    const timestamp = Date.now();
    const message = holderActionMessage('revoke', otherHolder, timestamp, ref);
    const hash = await sep0053MessageHash(message);
    const proof: HolderActionProof = {
      holder: otherHolder,
      signature: otherHolderKeypair.sign(Buffer.from(hash)).toString('base64'),
    };

    const result = await revokeStoredPresentation(ref, otherHolder, timestamp, proof);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect((await resolveStoredPresentation(ref)).status).toBe('ok');
  });

  it('reports not_found for a ref that never existed', async () => {
    const timestamp = Date.now();
    const ref = createPresentationRef();
    const proof = await signAction('revoke', timestamp, ref);

    const result = await revokeStoredPresentation(ref, REAL_HOLDER, timestamp, proof);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('listStoredPresentations', () => {
  it("lists the holder's own links, including revoked ones, excluding expired ones", async () => {
    const { ref: active } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });
    const { ref: revoked } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-b'],
      expiresAt: null,
    });
    const { ref: expiring } = await createStoredPresentation({
      holder: REAL_HOLDER,
      credentialIds: ['cred-c'],
      expiresAt: Date.now() + 1000,
    });

    const revokeTimestamp = Date.now();
    await revokeStoredPresentation(
      revoked,
      REAL_HOLDER,
      revokeTimestamp,
      await signAction('revoke', revokeTimestamp, revoked)
    );

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);

    const listTimestamp = Date.now();
    const result = await listStoredPresentations(
      REAL_HOLDER,
      listTimestamp,
      await signAction('list', listTimestamp)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const refs = result.links.map((link) => link.ref);
    expect(refs).toContain(active);
    expect(refs).toContain(revoked);
    expect(refs).not.toContain(expiring);
    expect(result.links.find((l) => l.ref === revoked)?.revokedAt).not.toBeNull();
  });

  it('rejects (invalid) a request signed by a different key than the claimed holder', async () => {
    const timestamp = Date.now();
    const proof = await signAction('list', timestamp, undefined, Keypair.random());

    const result = await listStoredPresentations(REAL_HOLDER, timestamp, proof);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });
});
