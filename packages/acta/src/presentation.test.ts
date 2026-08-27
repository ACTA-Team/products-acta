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
  sep0053MessageHash,
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

describe('sep0053MessageHash', () => {
  // Official test vectors from the SEP-0053 spec itself, so this checks our
  // implementation against the standard — not just internal round-trip
  // consistency — which is what makes a real wallet's signature (Freighter /
  // Stellar Wallets Kit, both SEP-0053-compliant) actually verify.
  // https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
  const SEED = 'SAKICEVQLYWGSOJS4WW7HZJWAHZVEEBS527LHK5V4MLJALYKICQCJXMW';
  const ADDRESS = 'GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L';

  it.each([
    [
      'Hello, World!',
      'fO5dbYhXUhBMhe6kId/cuVq/AfEnHRHEvsP8vXh03M1uLpi5e46yO2Q8rEBzu3feXQewcQE5GArp88u6ePK6BA==',
    ],
    [
      'こんにちは、世界！',
      'CDU265Xs8y3OWbB/56H9jPgUss5G9A0qFuTqH2zs2YDgTm+++dIfmAEceFqB7bhfN3am59lCtDXrCtwH2k1GBA==',
    ],
  ])('reproduces the spec signature for %j', async (message, expectedSignature) => {
    const hash = await sep0053MessageHash(message);
    const signer = Keypair.fromSecret(SEED);

    expect(signer.sign(Buffer.from(hash)).toString('base64')).toBe(expectedSignature);
    expect(
      Keypair.fromPublicKey(ADDRESS).verify(
        Buffer.from(hash),
        Buffer.from(expectedSignature, 'base64')
      )
    ).toBe(true);
  });
});

describe('verifyPresentationProof', () => {
  const keypair = Keypair.random();
  const otherKeypair = Keypair.random();
  const signerHolder = didStellar('testnet', keypair.publicKey());

  /** Signs `digest` the way a SEP-0053-compliant `signMessage` implementation
   * (Freighter / Stellar Wallets Kit) does — over the SEP-0053 preimage hash,
   * not the raw digest bytes. */
  async function signDigest(signer: Keypair, digest: string): Promise<string> {
    const hash = await sep0053MessageHash(digest);
    return signer.sign(Buffer.from(hash)).toString('base64');
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
      signature: await signDigest(keypair, digest),
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
      signature: await signDigest(otherKeypair, digest),
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
      signature: await signDigest(keypair, digest),
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
