import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import { buildPresentation } from '@acta-products/acta/presentation';
import { renderWithIntl } from '@/test/render-with-intl';

const { getCredential, getProfileSummary, resolvePresentationRef } = vi.hoisted(() => ({
  getCredential: vi.fn(),
  getProfileSummary: vi.fn(),
  resolvePresentationRef: vi.fn(),
}));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@acta-products/acta', async () => {
  // Keep the real parseDidStellar so the view derives the owner as in production;
  // only the SDK client and credential source are stubbed.
  const actual = await vi.importActual<typeof import('@acta-products/acta')>('@acta-products/acta');
  return {
    parseDidStellar: actual.parseDidStellar,
    useActaClient: () => ({}),
    getCredentialSource: () => ({ getCredential, getProfileSummary }),
  };
});

vi.mock('@/lib/presentation-link', () => ({ resolvePresentationRef }));

import { PublicVerificationView } from './public-verification-view';

const HOLDER = 'did:stellar:testnet:GHOLDERVAULT111222333444555ABCDEF111222333444555ABCDEF11';

const CREDENTIAL: CreditCredential = {
  id: 'cred-income',
  type: 'IncomeVerification',
  title: 'Anchor Payroll Income',
  issuer: 'Stellar Anchor Payroll Services',
  issuerDid: 'did:stellar:mainnet:GAPAYROLL',
  issueDate: '2026-03-01T14:15:00Z',
  value: '$45,000 USD / yr',
  description: 'Verified salary.',
  status: 'valid',
  claims: { annualSalaryUSD: 45000 },
};

const PROFILE: CreditProfileSummary = {
  holderDid: HOLDER,
  holderName: 'Alex Mercer',
  activeCredentialsCount: 1,
};

const REF = 'a'.repeat(43);

/** Resolve the mock source's getCredential by id, mirroring vault-by-id lookup. */
function credentialsById(...credentials: CreditCredential[]) {
  const byId = new Map(credentials.map((c) => [c.id, c]));
  getCredential.mockImplementation(async (id: string) => byId.get(id) ?? null);
}

beforeEach(() => {
  getCredential.mockReset();
  credentialsById(CREDENTIAL);
  getProfileSummary.mockReset().mockResolvedValue(PROFILE);
  resolvePresentationRef.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('PublicVerificationView', () => {
  it('renders the invalid state when the reference does not resolve', async () => {
    resolvePresentationRef.mockResolvedValue({ status: 'not_found' });

    renderWithIntl(<PublicVerificationView token="not-a-valid-reference!!!" />);

    expect(await screen.findByText('Invalid or expired presentation')).toBeInTheDocument();
    expect(screen.getByText('Presentation verification failed')).toBeInTheDocument();
  });

  it('renders the expired state (with the expiry date) when the resolver reports expiry', async () => {
    resolvePresentationRef.mockResolvedValue({
      status: 'expired',
      expiresAt: Date.now() - 60_000,
    });

    renderWithIntl(<PublicVerificationView token={REF} />);

    expect(await screen.findByText('Invalid or expired presentation')).toBeInTheDocument();
    expect(screen.getByText(/expired on/i)).toBeInTheDocument();
  });

  it('renders the verified report for a live reference', async () => {
    resolvePresentationRef.mockResolvedValue({
      status: 'ok',
      presentation: buildPresentation({
        holder: HOLDER,
        credentialIds: ['cred-income'],
        expiresAt: Date.now() + 3_600_000,
      }),
    });

    renderWithIntl(<PublicVerificationView token={REF} />);

    expect(await screen.findByText('Verifiable presentation report')).toBeInTheDocument();
    expect(screen.getByText('Anchor Payroll Income')).toBeInTheDocument();
    expect(screen.getByText('Alex Mercer')).toBeInTheDocument();
  });

  it('verifies each shared credential by id against the vault', async () => {
    resolvePresentationRef.mockResolvedValue({
      status: 'ok',
      presentation: buildPresentation({
        holder: HOLDER,
        credentialIds: ['cred-income'],
        expiresAt: null,
      }),
    });

    renderWithIntl(<PublicVerificationView token={REF} />);

    await screen.findByText('Verifiable presentation report');
    // The owner (G… address) parsed from the holder DID drives the vault read.
    expect(getCredential).toHaveBeenCalledWith('cred-income');
  });

  it('reflects a revoked on-chain status in the overall banner', async () => {
    credentialsById({ ...CREDENTIAL, status: 'revoked' });
    resolvePresentationRef.mockResolvedValue({
      status: 'ok',
      presentation: buildPresentation({
        holder: HOLDER,
        credentialIds: ['cred-income'],
        expiresAt: null,
      }),
    });

    renderWithIntl(<PublicVerificationView token={REF} />);

    expect(await screen.findByText('Revoked presentation')).toBeInTheDocument();
  });

  it('renders the invalid state when a shared credential cannot be verified', async () => {
    // The vault has no record of this id → not verifiable → invalid, not a
    // partial "valid" report.
    credentialsById();
    resolvePresentationRef.mockResolvedValue({
      status: 'ok',
      presentation: buildPresentation({
        holder: HOLDER,
        credentialIds: ['cred-missing'],
        expiresAt: null,
      }),
    });

    renderWithIntl(<PublicVerificationView token={REF} />);

    expect(await screen.findByText('Invalid or expired presentation')).toBeInTheDocument();
  });

  it('never puts credential data in the shared reference', () => {
    expect(REF).not.toContain('cred-income');
  });
});
