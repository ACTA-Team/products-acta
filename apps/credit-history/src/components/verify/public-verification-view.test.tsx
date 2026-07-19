import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import { renderWithIntl } from '@/test/render-with-intl';
import { encodePresentationToken } from '@/lib/presentation-token';

const { listCredentials, getProfileSummary } = vi.hoisted(() => ({
  listCredentials: vi.fn(),
  getProfileSummary: vi.fn(),
}));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@acta-products/acta', () => ({
  getCredentialSource: () => ({ listCredentials, getProfileSummary }),
}));

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

beforeEach(() => {
  listCredentials.mockReset().mockResolvedValue([CREDENTIAL]);
  getProfileSummary.mockReset().mockResolvedValue(PROFILE);
});

afterEach(() => {
  cleanup();
});

describe('PublicVerificationView', () => {
  it('renders the invalid state for a malformed token', async () => {
    renderWithIntl(<PublicVerificationView token="not-a-valid-token!!!" />);
    expect(await screen.findByText('Invalid or expired presentation')).toBeInTheDocument();
    expect(screen.getByText('Presentation verification failed')).toBeInTheDocument();
  });

  it('renders the expired state (with the expiry date) for an expired token', async () => {
    const token = encodePresentationToken({ ids: ['cred-income'], exp: Date.now() - 60_000 });
    renderWithIntl(<PublicVerificationView token={token} />);
    expect(await screen.findByText('Invalid or expired presentation')).toBeInTheDocument();
    expect(screen.getByText(/expired on/i)).toBeInTheDocument();
  });

  it('renders the verified report for a valid token', async () => {
    const token = encodePresentationToken({ ids: ['cred-income'], exp: Date.now() + 3_600_000 });
    renderWithIntl(<PublicVerificationView token={token} />);
    expect(await screen.findByText('Verifiable presentation report')).toBeInTheDocument();
    expect(screen.getByText('Anchor Payroll Income')).toBeInTheDocument();
    expect(screen.getByText('Alex Mercer')).toBeInTheDocument();
  });
});
