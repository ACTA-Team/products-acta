/**
 * POST /api/presentations — create a shareable presentation.
 *
 * The holder posts the credential ids they picked, the expiration they chose
 * and (when the wallet could produce one) a proof over the presentation
 * digest. The response only contains the opaque reference; the payload itself
 * never leaves the server.
 */

import { NextResponse } from 'next/server';
import {
  buildPresentation,
  InvalidPresentationError,
  presentationDigest,
  presentationExpiresAt,
  type PresentationProof,
} from '@acta-products/acta/presentation';
import { createStoredPresentation, MAX_CREATED_AT_DRIFT_MS } from '@/lib/presentation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateRequestBody {
  holder?: unknown;
  credentialIds?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  proof?: unknown;
}

/** Sane upper bound on proof field lengths — mirrors the one in presentation.ts. */
const MAX_PROOF_FIELD_LENGTH = 4096;

class MalformedProofError extends Error {}

/**
 * Structurally validate a proof and, when the shape checks out, verify it
 * actually matches the presentation the server is about to persist: the
 * digest must match what the server independently recomputes from
 * `holder`/`credentialIds`/`expiresAt`/`createdAt`, and `verificationMethod`
 * must equal `holder`. A proof that fails either check can never verify later
 * either — it must never be persisted, so callers should map
 * `MalformedProofError` to a 400 rather than silently dropping the proof and
 * storing the presentation unsigned.
 *
 * (Signature validity itself is intentionally NOT checked here —
 * `verifyPresentationProof` does that at read time. This only rejects proofs
 * that are provably inconsistent with the presentation being created.)
 */
async function parseProof(
  raw: unknown,
  expected: { holder: string; credentialIds: string[]; expiresAt: number | null; createdAt: number }
): Promise<PresentationProof | undefined> {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'object' || raw === null) {
    throw new MalformedProofError('proof must be an object.');
  }
  const proof = raw as Record<string, unknown>;

  const fields = [proof.digest, proof.signature, proof.verificationMethod];
  if (
    fields.some((f) => typeof f !== 'string' || f.length === 0 || f.length > MAX_PROOF_FIELD_LENGTH)
  ) {
    throw new MalformedProofError(
      'proof.digest, proof.signature and proof.verificationMethod must be non-empty strings within length bounds.'
    );
  }
  if (proof.created !== undefined && typeof proof.created !== 'string') {
    throw new MalformedProofError('proof.created must be a string when present.');
  }

  const digest = proof.digest as string;
  const signature = proof.signature as string;
  const verificationMethod = proof.verificationMethod as string;

  if (verificationMethod !== expected.holder) {
    throw new MalformedProofError('proof.verificationMethod must match the presentation holder.');
  }

  const expectedDigest = await presentationDigest(buildPresentation(expected));
  if (digest !== expectedDigest) {
    throw new MalformedProofError('proof.digest does not match the presentation being created.');
  }

  return {
    type: 'StellarWalletSignature2026',
    created: typeof proof.created === 'string' ? proof.created : new Date().toISOString(),
    verificationMethod,
    digest,
    signature,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: CreateRequestBody;

  try {
    body = (await request.json()) as CreateRequestBody;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  const { holder, credentialIds, expiresAt, createdAt } = body;

  if (typeof holder !== 'string' || holder.length === 0) {
    return NextResponse.json({ error: 'A holder DID is required.' }, { status: 400 });
  }

  if (!Array.isArray(credentialIds)) {
    return NextResponse.json({ error: 'credentialIds must be an array.' }, { status: 400 });
  }

  if (expiresAt !== null && typeof expiresAt !== 'number') {
    return NextResponse.json(
      { error: 'expiresAt must be a timestamp in milliseconds or null.' },
      { status: 400 }
    );
  }

  if (createdAt !== undefined && typeof createdAt !== 'number') {
    return NextResponse.json(
      { error: 'createdAt must be a timestamp in milliseconds.' },
      { status: 400 }
    );
  }

  // Resolved once and reused for both the digest recomputation below and the
  // actual persisted presentation, so a proof signed against "now" on the
  // client can't drift from what the server rebuilds server-side.
  const resolvedCreatedAt = createdAt ?? Date.now();
  if (Math.abs(Date.now() - resolvedCreatedAt) > MAX_CREATED_AT_DRIFT_MS) {
    return NextResponse.json(
      { error: 'createdAt is too far from the server clock.' },
      { status: 400 }
    );
  }

  let proof: PresentationProof | undefined;
  try {
    proof = await parseProof(body.proof, {
      holder,
      credentialIds: credentialIds as string[],
      expiresAt,
      createdAt: resolvedCreatedAt,
    });
  } catch (err) {
    if (err instanceof MalformedProofError || err instanceof InvalidPresentationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Failed to validate presentation proof', err);
    return NextResponse.json({ error: 'Could not create the presentation.' }, { status: 500 });
  }

  try {
    const { ref, presentation } = await createStoredPresentation({
      holder,
      credentialIds: credentialIds as string[],
      expiresAt,
      createdAt: resolvedCreatedAt,
      proof,
    });

    return NextResponse.json(
      { ref, expiresAt: presentationExpiresAt(presentation) },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (err instanceof InvalidPresentationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Failed to create presentation', err);
    return NextResponse.json({ error: 'Could not create the presentation.' }, { status: 500 });
  }
}