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
import {
  buildPresentation,
  presentationDigest,
  sep0053MessageHash,
} from '@acta-products/acta/presentation';
import { didStellar } from '@acta-products/acta/did';
import {
  createStoredPresentation,
  holderActionMessage,
  isPresentationRef,
  resolveStoredPresentation,
  setPresentationStore,
} from '@/lib/presentation-store';
import { GET, POST } from './route';

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
  const hash = await sep0053MessageHash(digest);
  return {
    type: 'StellarWalletSignature2026' as const,
    created: new Date(overrides.createdAt).toISOString(),
    verificationMethod: holder,
    digest,
    signature: signer.sign(Buffer.from(hash)).toString('base64'),
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

  it('rejects (400) a proof with an oversized proof.created', async () => {
    const createdAt = Date.now();
    const proof = await signedProof({ credentialIds: ['cred-a'], expiresAt: null, createdAt });

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof: { ...proof, created: proof.created + 'a'.repeat(5000) },
    });

    expect(res.status).toBe(400);
  });

  it('rejects (400) a proof with an unparseable proof.created', async () => {
    const createdAt = Date.now();
    const proof = await signedProof({ credentialIds: ['cred-a'], expiresAt: null, createdAt });

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof: { ...proof, created: 'not-a-timestamp' },
    });

    expect(res.status).toBe(400);
  });

  it("defaults an omitted proof.created to the presentation's own createdAt", async () => {
    const createdAt = Date.now();
    const fullProof = await signedProof({ credentialIds: ['cred-a'], expiresAt: null, createdAt });
    const proofWithoutCreated: Partial<typeof fullProof> = { ...fullProof };
    delete proofWithoutCreated.created;

    const res = await post({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
      createdAt,
      proof: proofWithoutCreated,
    });
    expect(res.status).toBe(201);

    const { ref } = (await res.json()) as { ref: string };
    const resolved = await resolveStoredPresentation(ref);
    expect(resolved.status).toBe('ok');
    if (resolved.status !== 'ok') return;
    expect(resolved.presentation.proof?.created).toBe(new Date(createdAt).toISOString());
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

  it('rejects (429) after the per-holder creation rate limit is exceeded', async () => {
    const holder = didStellar('testnet', Keypair.random().publicKey());

    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      last = await post({ holder, credentialIds: ['cred-a'], expiresAt: null });
    }

    expect(last?.status).toBe(429);
  });
});

describe('GET /api/presentations', () => {
  function get(params: Record<string, string>): Promise<Response> {
    const url = new URL('http://localhost/api/presentations');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return GET(new Request(url));
  }

  it("lists the holder's own links with a valid signature", async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a', 'cred-b'],
      expiresAt: null,
    });

    const timestamp = Date.now();
    const message = holderActionMessage('list', HOLDER, timestamp);
    const hash = await sep0053MessageHash(message);
    const signature = keypair.sign(Buffer.from(hash)).toString('base64');

    const res = await get({ holder: HOLDER, timestamp: String(timestamp), signature });
    expect(res.status).toBe(200);

    const { links } = (await res.json()) as { links: { ref: string; credentialCount: number }[] };
    expect(links).toContainEqual(expect.objectContaining({ ref, credentialCount: 2 }));
  });

  it('rejects (403) a signature that does not match the claimed holder', async () => {
    const timestamp = Date.now();
    const message = holderActionMessage('list', HOLDER, timestamp);
    const hash = await sep0053MessageHash(message);
    const signature = Keypair.random().sign(Buffer.from(hash)).toString('base64');

    const res = await get({ holder: HOLDER, timestamp: String(timestamp), signature });
    expect(res.status).toBe(403);
  });

  it('rejects (400) a request missing required query params', async () => {
    const res = await get({ holder: HOLDER });
    expect(res.status).toBe(400);
  });
});
