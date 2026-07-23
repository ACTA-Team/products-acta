import { describe, expect, it } from 'vitest';
import type { BuildPresentationInput } from './presentation';
import {
  attachPresentationProof,
  buildPresentation,
  canonicalPresentationPayload,
  InvalidPresentationError,
  isPresentationExpired,
  MAX_PRESENTATION_CREDENTIALS,
  presentationDigest,
  presentationExpiresAt,
} from './presentation';

const HOLDER = 'did:stellar:testnet:GHOLDER';
const NOW = Date.parse('2026-07-22T12:00:00.000Z');

describe('buildPresentation', () => {
  it('builds a W3C-shaped presentation that references credentials by id only', () => {
    const vp = buildPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a', 'cred-b'],
      expiresAt: NOW + 3_600_000,
      createdAt: NOW,
    });

    expect(vp).toEqual({
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiablePresentation'],
      holder: HOLDER,
      verifiableCredential: ['cred-a', 'cred-b'],
      created: '2026-07-22T12:00:00.000Z',
      expires: '2026-07-22T13:00:00.000Z',
    });
    expect(JSON.stringify(vp)).not.toContain('claims');
  });

  it('accepts a null expiration for links that never expire', () => {
    const vp = buildPresentation({ holder: HOLDER, credentialIds: ['a'], expiresAt: null });
    expect(vp.expires).toBeNull();
    expect(presentationExpiresAt(vp)).toBeNull();
    expect(isPresentationExpired(vp)).toBe(false);
  });

  it('deduplicates credential ids while preserving order', () => {
    const vp = buildPresentation({
      holder: HOLDER,
      credentialIds: ['b', 'a', 'b'],
      expiresAt: null,
    });
    expect(vp.verifiableCredential).toEqual(['b', 'a']);
  });

  it.each<[string, BuildPresentationInput]>([
    ['an empty holder', { holder: '', credentialIds: ['a'], expiresAt: null }],
    ['no credentials', { holder: HOLDER, credentialIds: [], expiresAt: null }],
    ['a blank credential id', { holder: HOLDER, credentialIds: [''], expiresAt: null }],
    [
      'an expiration in the past',
      { holder: HOLDER, credentialIds: ['a'], expiresAt: NOW - 1, createdAt: NOW },
    ],
    [
      'too many credentials',
      {
        holder: HOLDER,
        credentialIds: Array.from({ length: MAX_PRESENTATION_CREDENTIALS + 1 }, (_, i) => `c${i}`),
        expiresAt: null,
      },
    ],
  ])('rejects %s', (_label, input) => {
    expect(() => buildPresentation(input)).toThrow(InvalidPresentationError);
  });
});

describe('canonicalPresentationPayload', () => {
  it('is stable regardless of key order and excludes the proof', async () => {
    const vp = buildPresentation({
      holder: HOLDER,
      credentialIds: ['a'],
      expiresAt: null,
      createdAt: NOW,
    });
    const digest = await presentationDigest(vp);

    const signed = attachPresentationProof(vp, {
      type: 'StellarWalletSignature2026',
      created: new Date(NOW).toISOString(),
      verificationMethod: HOLDER,
      digest,
      signature: 'signed-xdr',
    });

    expect(canonicalPresentationPayload(signed)).toBe(canonicalPresentationPayload(vp));
    expect(await presentationDigest(signed)).toBe(digest);

    const reordered = {
      ...vp,
      created: vp.created,
      holder: vp.holder,
    };
    expect(canonicalPresentationPayload(reordered)).toBe(canonicalPresentationPayload(vp));
  });

  it('changes the digest when the expiration changes', async () => {
    const base = buildPresentation({
      holder: HOLDER,
      credentialIds: ['a'],
      expiresAt: NOW + 1000,
      createdAt: NOW,
    });
    const tampered = { ...base, expires: new Date(NOW + 999_999).toISOString() };

    expect(await presentationDigest(tampered)).not.toBe(await presentationDigest(base));
  });
});

describe('isPresentationExpired', () => {
  it('reports expiry against the given clock', () => {
    const vp = buildPresentation({
      holder: HOLDER,
      credentialIds: ['a'],
      expiresAt: NOW + 1000,
      createdAt: NOW,
    });

    expect(isPresentationExpired(vp, NOW)).toBe(false);
    expect(isPresentationExpired(vp, NOW + 1001)).toBe(true);
  });

  it('treats an unparseable expiry as expired', () => {
    const vp = buildPresentation({ holder: HOLDER, credentialIds: ['a'], expiresAt: null });
    expect(isPresentationExpired({ ...vp, expires: 'not-a-date' })).toBe(true);
  });
});
