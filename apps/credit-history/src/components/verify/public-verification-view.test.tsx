import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import { buildPresentation } from '@acta-products/acta/presentation';
import { renderWithIntl } from '@/test/render-with-intl';

const { listCredentials, getProfileSummary, resolvePresentationRef } = vi.hoisted(() => ({
  listCredentials: vi.fn(),
  getProfileSummary: vi.fn(),
  resolvePresentationRef: vi.fn(),
}));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@acta-products/acta', () => ({
  getCredentialSource: () => ({ listCredentials, getProfileSummary }),
}));

vi.mock('@/lib/presentation-link', () => ({ resolvePresentationRef }));

import { PublicVerificationView } from './public-verification-view';

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
  holderDid: 'did:stellar:testnet:GHOLDER',
  holderName: 'Alex Mercer',
  activeCredentialsCount: 1,
};

const REF = 'a'.repeat(43);

beforeEach(() => {
  listCredentials.mockReset().mockResolvedValue([CREDENTIAL]);
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
        holder: 'did:stellar:testnet:GHOLDER',
        credentialIds: ['cred-income'],
        expiresAt: Date.now() + 3_600_000,
      }),
    });

    renderWithIntl(<PublicVerificationView token={REF} />);

    expect(await screen.findByText('Verifiable presentation report')).toBeInTheDocument();
    expect(screen.getByText('Anchor Payroll Income')).toBeInTheDocument();
    expect(screen.getByText('Alex Mercer')).toBeInTheDocument();
  });

  it('never puts credential data in the shared reference', () => {
    expect(REF).not.toContain('cred-income');
  });
});
