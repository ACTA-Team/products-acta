import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { didStellar } from './did';
import type { BuildPresentationInput, PresentationProof } from './presentation';
import {
  attachPresentationProof,
  buildPresentation,
  canonicalPresentationPayload,
  InvalidPresentationError,
  isPresentationExpired,
  MAX_PRESENTATION_CREDENTIALS,
  presentationDigest,
  presentationExpiresAt,
  verifyPresentationProof,
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

describe('verifyPresentationProof', () => {
  const keypair = Keypair.random();
  const otherKeypair = Keypair.random();
  const signerHolder = didStellar('testnet', keypair.publicKey());

  /** Signs `digest` the way `signPresentation` does: the base64url digest
   * string, UTF-8 encoded, ed25519-signed, signature base64-encoded. */
  function signDigest(signer: Keypair, digest: string): string {
    return signer.sign(Buffer.from(digest, 'utf8')).toString('base64');
  }

  async function buildSignedPresentation(
    overrides: Partial<PresentationProof> = {}
  ): Promise<ReturnType<typeof buildPresentation>> {
    const vp = buildPresentation({
      holder: signerHolder,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt: NOW,
    });
    const digest = await presentationDigest(vp);

    return attachPresentationProof(vp, {
      type: 'StellarWalletSignature2026',
      created: new Date(NOW).toISOString(),
      verificationMethod: signerHolder,
      digest,
      signature: signDigest(keypair, digest),
      ...overrides,
    });
  }

  it('reports unsigned when no proof is attached', async () => {
    const vp = buildPresentation({ holder: signerHolder, credentialIds: ['a'], expiresAt: null });
    expect(await verifyPresentationProof(vp)).toEqual({ status: 'unsigned' });
  });

  it('verifies a round-trip signed presentation as signed', async () => {
    const signed = await buildSignedPresentation();
    expect(await verifyPresentationProof(signed)).toEqual({ status: 'signed' });
  });

  it('reports a digest mismatch when the presentation is tampered with after signing', async () => {
    const signed = await buildSignedPresentation();
    const tampered = { ...signed, verifiableCredential: ['cred-a', 'cred-injected'] };

    expect(await verifyPresentationProof(tampered)).toEqual({
      status: 'mismatch',
      reason: 'digest',
    });
  });

  it('reports a signature mismatch when the proof was produced by a different key', async () => {
    const vp = buildPresentation({
      holder: signerHolder,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt: NOW,
    });
    const digest = await presentationDigest(vp);
    const signed = attachPresentationProof(vp, {
      type: 'StellarWalletSignature2026',
      created: new Date(NOW).toISOString(),
      verificationMethod: signerHolder,
      digest,
      signature: signDigest(otherKeypair, digest),
    });

    expect(await verifyPresentationProof(signed)).toEqual({
      status: 'mismatch',
      reason: 'signature',
    });
  });

  it('reports a holder mismatch when verificationMethod is not the presentation holder', async () => {
    const impersonatedHolder = didStellar('testnet', otherKeypair.publicKey());
    const signed = await buildSignedPresentation({ verificationMethod: impersonatedHolder });

    expect(await verifyPresentationProof(signed)).toEqual({
      status: 'mismatch',
      reason: 'holder',
    });
  });

  it('reports malformed for a proof with an unparsable holder DID', async () => {
    const vp = buildPresentation({
      holder: 'not-a-did',
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt: NOW,
    });
    const digest = await presentationDigest(vp);
    const signed = attachPresentationProof(vp, {
      type: 'StellarWalletSignature2026',
      created: new Date(NOW).toISOString(),
      verificationMethod: 'not-a-did',
      digest,
      signature: signDigest(keypair, digest),
    });

    expect(await verifyPresentationProof(signed)).toEqual({
      status: 'mismatch',
      reason: 'malformed',
    });
  });

  it('reports malformed for empty proof fields rather than throwing', async () => {
    const signed = await buildSignedPresentation({ signature: '' });
    expect(await verifyPresentationProof(signed)).toEqual({
      status: 'mismatch',
      reason: 'malformed',
    });
  });

  it('never lets an unattributed (unsigned) presentation read as invalid', async () => {
    // unsigned is a distinct status from mismatch — callers must not collapse
    // the two, since an unsigned link is still legitimate.
    const vp = buildPresentation({ holder: signerHolder, credentialIds: ['a'], expiresAt: null });
    const result = await verifyPresentationProof(vp);
    expect(result.status).not.toBe('mismatch');
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