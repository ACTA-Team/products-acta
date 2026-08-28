/**
 * GET /api/presentations/[ref] — resolve a share reference.
 *
 * Expiration is enforced here, not by the caller: an expired reference returns
 * 410 and is dropped from the store, so editing the URL cannot extend a link.
 */

import { NextResponse } from 'next/server';
import { verifyPresentationProof, type HolderActionProof } from '@acta-products/acta/presentation';
import { resolveStoredPresentation, revokeStoredPresentation } from '@/lib/presentation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ref: string }> }
): Promise<NextResponse> {
  const { ref } = await params;
  const resolution = await resolveStoredPresentation(ref);

  if (resolution.status === 'not_found') {
    return NextResponse.json({ reason: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  if (resolution.status === 'expired') {
    return NextResponse.json(
      { reason: 'expired', expiresAt: resolution.expiresAt },
      { status: 410, headers: NO_STORE }
    );
  }

  if (resolution.status === 'revoked') {
    // Revocation of the share link, not of a credential — a credential's own
    // revocation lives on-chain and is reported per-credential via
    // `vaultVerify`, independent of whether this link still resolves.
    return NextResponse.json(
      { reason: 'revoked', revokedAt: resolution.revokedAt },
      { status: 410, headers: NO_STORE }
    );
  }

  // Verified here rather than in the (client) verifier view: `Keypair.verify`
  // needs Node crypto primitives this route already runs with
  // (`runtime = 'nodejs'`), and verification never has to ship into a browser
  // bundle this way. This is purely an attribution check — it never affects
  // credential status, which the client still reads from the vault directly.
  const proof = await verifyPresentationProof(resolution.presentation);

  return NextResponse.json(
    { presentation: resolution.presentation, proof },
    { status: 200, headers: NO_STORE }
  );
}

interface RevokeRequestBody {
  holder?: unknown;
  timestamp?: unknown;
  signature?: unknown;
}

/**
 * `DELETE /api/presentations/[ref]` — revokes a link on behalf of its holder.
 * The body must prove control of the holder key over
 * `ACTA:presentations:revoke:{ref}:{holder}:{timestamp}` (see
 * `holderActionMessage` in `presentation-store.ts`) — the client asserting
 * "I am the holder" is never accepted on its own.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ref: string }> }
): Promise<NextResponse> {
  const { ref } = await params;

  let body: RevokeRequestBody;
  try {
    body = (await request.json()) as RevokeRequestBody;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400, headers: NO_STORE });
  }

  const { holder, timestamp, signature } = body;
  if (typeof holder !== 'string' || holder.length === 0) {
    return NextResponse.json(
      { error: 'A holder DID is required.' },
      { status: 400, headers: NO_STORE }
    );
  }
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return NextResponse.json(
      { error: 'timestamp must be a numeric epoch-milliseconds value.' },
      { status: 400, headers: NO_STORE }
    );
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    return NextResponse.json(
      { error: 'A signature is required.' },
      { status: 400, headers: NO_STORE }
    );
  }

  const proof: HolderActionProof = { holder, signature };
  const result = await revokeStoredPresentation(ref, holder, timestamp, proof);

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return NextResponse.json({ reason: 'not_found' }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(
      { error: `Could not authorise the request (${result.reason}).` },
      { status: 403, headers: NO_STORE }
    );
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
