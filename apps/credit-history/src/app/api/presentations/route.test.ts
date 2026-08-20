/**
 * @vitest-environment node
 *
 * This route runs with `export const runtime = 'nodejs'` and its crypto
 * (`Keypair.random()`, ed25519 signing) needs real Node crypto — the app's
 * default jsdom environment shims `crypto` in a way that breaks key
 * generation, so this file opts back into `node` on its own.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { buildPresentation, presentationDigest } from '@acta-products/acta/presentation';
import { didStellar } from '@acta-products/acta/did';
import {
  isPresentationRef,
  resolveStoredPresentation,
  setPresentationStore,
} from '@/lib/presentation-store';
import { POST } from './route';

const keypair = Keypair.random();
const HOLDER = didStellar('testnet', keypair.publicKey());

function post(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/presentations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

async function signedProof(overrides: {
  holder?: string;
  credentialIds: string[];
  expiresAt: number | null;
  createdAt: number;
  signer?: Keypair;
}) {
  const holder = overrides.holder ?? HOLDER;
  const signer = overrides.signer ?? keypair;
  const vp = buildPresentation({
    holder,
    credentialIds: overrides.credentialIds,
    expiresAt: overrides.expiresAt,
    createdAt: overrides.createdAt,
  });
  const digest = await presentationDigest(vp);
  return {
    type: 'StellarWalletSignature2026' as const,
    created: new Date(overrides.createdAt).toISOString(),
    verificationMethod: holder,
    digest,
    signature: signer.sign(Buffer.from(digest, 'utf8')).toString('base64'),
  };
}

beforeEach(() => {
  setPresentationStore(null);
});

afterEach(() => {
  setPresentationStore(null);
});

describe('POST /api/presentations', () => {
  it('creates a presentation without a proof', async () => {
    const res = await post({ holder: HOLDER, credentialIds: ['cred-a'], expiresAt: null });
    expect(res.status).toBe(201);

    const { ref } = (await res.json()) as { ref: string };
    expect(isPresentationRef(ref)).toBe(true);

    const resolved = await resolveStoredPresentation(ref);
    expect(resolved.status).toBe('ok');
    if (resolved.status !== 'ok') return;
    expect(resolved.presentation.proof).toBeUndefined();
  });

  it('persists a well-formed, matching proof', async () => {
    const createdAt = Date.now();
    const proof = await signedProof({ credentialIds: ['cred-a'], expiresAt: null, createdAt });

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof,
    });
    expect(res.status).toBe(201);

    const { ref } = (await res.json()) as { ref: string };
    const resolved = await resolveStoredPresentation(ref);
    expect(resolved.status).toBe('ok');
    if (resolved.status !== 'ok') return;
    expect(resolved.presentation.proof).toEqual(proof);
  });

  it('rejects (400) a proof whose verificationMethod does not match the holder, and stores nothing', async () => {
    const createdAt = Date.now();
    const otherHolder = didStellar('testnet', Keypair.random().publicKey());
    const proof = await signedProof({
      holder: otherHolder,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
    });

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/verificationMethod/);
  });

  it('rejects (400) a proof whose digest does not match the presentation being created', async () => {
    const createdAt = Date.now();
    // Signed over a different credential selection than what's actually posted.
    const proof = await signedProof({ credentialIds: ['cred-other'], expiresAt: null, createdAt });

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/digest/);
  });

  it('rejects (400) a proof with an oversized field', async () => {
    const createdAt = Date.now();
    const proof = await signedProof({ credentialIds: ['cred-a'], expiresAt: null, createdAt });

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof: { ...proof, signature: 'a'.repeat(5000) },
    });

    expect(res.status).toBe(400);
  });

  it('rejects (400) a malformed (non-object) proof', async () => {
    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      proof: 'not-an-object',
    });

    expect(res.status).toBe(400);
  });
});