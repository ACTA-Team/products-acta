import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidPresentationError } from '@acta-products/acta/presentation';
import {
  createPresentationRef,
  createStoredPresentation,
  isPresentationRef,
  MAX_CREATED_AT_DRIFT_MS,
  resolveStoredPresentation,
} from './presentation-store';

const HOLDER = 'did:stellar:testnet:GHOLDER';

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
});
