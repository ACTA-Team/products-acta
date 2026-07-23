/**
 * GET /api/presentations/[ref] — resolve a share reference.
 *
 * Expiration is enforced here, not by the caller: an expired reference returns
 * 410 and is dropped from the store, so editing the URL cannot extend a link.
 */

import { NextResponse } from 'next/server';
import { resolveStoredPresentation } from '@/lib/presentation-store';

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

  return NextResponse.json(
    { presentation: resolution.presentation },
    { status: 200, headers: NO_STORE }
  );
}
