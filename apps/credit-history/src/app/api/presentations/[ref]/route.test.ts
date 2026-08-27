/**
 * @vitest-environment node
 *
 * Signs with real ed25519 keys via `@stellar/stellar-sdk` — see the same note
 * in `app/api/presentations/route.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { didStellar } from '@acta-products/acta/did';
import { sep0053MessageHash } from '@acta-products/acta/presentation';
import {
  createPresentationRef,
  createStoredPresentation,
  holderActionMessage,
  setPresentationStore,
} from '@/lib/presentation-store';
import { DELETE, GET } from './route';

const keypair = Keypair.random();
const HOLDER = didStellar('testnet', keypair.publicKey());

function get(ref: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/presentations/${ref}`), {
    params: Promise.resolve({ ref }),
  });
}

async function del(ref: string, body: unknown): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/presentations/${ref}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ ref }) }
  );
}

async function revokeBody(
  ref: string,
  timestamp: number,
  signer: Keypair = keypair,
  holder = HOLDER
) {
  const message = holderActionMessage('revoke', holder, timestamp, ref);
  const hash = await sep0053MessageHash(message);
  return { holder, timestamp, signature: signer.sign(Buffer.from(hash)).toString('base64') };
}

beforeEach(() => {
  setPresentationStore(null);
});

afterEach(() => {
  setPresentationStore(null);
  vi.useRealTimers();
});

describe('GET /api/presentations/[ref]', () => {
  it('returns 404 for an unknown ref', async () => {
    const res = await get(createPresentationRef());
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe('not_found');
  });

  it('returns 410 with reason expired for an expired link', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: Date.now() + 1000,
    });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);

    const res = await get(ref);
    expect(res.status).toBe(410);
    expect((await res.json()).reason).toBe('expired');
  });

  it('returns 410 with reason revoked for a revoked link, distinct from expired', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });

    const timestamp = Date.now();
    await del(ref, await revokeBody(ref, timestamp));

    const res = await get(ref);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { reason: string; revokedAt: number };
    expect(body.reason).toBe('revoked');
    expect(body.revokedAt).toBeGreaterThan(0);
  });
});

describe('DELETE /api/presentations/[ref]', () => {
  it("revokes the link with the holder's signature", async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });

    const res = await del(ref, await revokeBody(ref, Date.now()));
    expect(res.status).toBe(204);
  });

  it('rejects (403) a signature from a different key', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });

    const res = await del(ref, await revokeBody(ref, Date.now(), Keypair.random()));
    expect(res.status).toBe(403);

    // Still resolves — the failed revocation must not have taken effect.
    const check = await get(ref);
    expect(check.status).toBe(200);
  });

  it('rejects (403) a stale timestamp', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });

    const res = await del(ref, await revokeBody(ref, Date.now() - 10 * 60 * 1000));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a ref that does not belong to the claimed holder', async () => {
    const otherKeypair = Keypair.random();
    const otherHolder = didStellar('testnet', otherKeypair.publicKey());

    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });

    const res = await del(ref, await revokeBody(ref, Date.now(), otherKeypair, otherHolder));
    expect(res.status).toBe(404);
  });

  it('rejects (400) a malformed body', async () => {
    const { ref } = await createStoredPresentation({
      holder: HOLDER,
      credentialIds: ['cred-a'],
      expiresAt: null,
    });

    const res = await DELETE(
      new Request(`http://localhost/api/presentations/${ref}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ ref }) }
    );
    expect(res.status).toBe(400);
  });
});
