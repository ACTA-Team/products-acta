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
  InvalidPresentationError,
  presentationExpiresAt,
  type PresentationProof,
} from '@acta-products/acta/presentation';
import { createStoredPresentation } from '@/lib/presentation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateRequestBody {
  holder?: unknown;
  credentialIds?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  proof?: unknown;
}

function parseProof(raw: unknown): PresentationProof | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const proof = raw as Record<string, unknown>;

  if (
    typeof proof.digest !== 'string' ||
    typeof proof.signature !== 'string' ||
    typeof proof.verificationMethod !== 'string'
  ) {
    return undefined;
  }

  return {
    type: 'StellarWalletSignature2026',
    created: typeof proof.created === 'string' ? proof.created : new Date().toISOString(),
    verificationMethod: proof.verificationMethod,
    digest: proof.digest,
    signature: proof.signature,
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

  try {
    const { ref, presentation } = await createStoredPresentation({
      holder,
      credentialIds: credentialIds as string[],
      expiresAt,
      createdAt,
      proof: parseProof(body.proof),
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
