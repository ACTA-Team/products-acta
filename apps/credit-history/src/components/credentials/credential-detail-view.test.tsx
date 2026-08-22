import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import type { CreditCredential } from '@acta-products/acta/types';
import { renderWithIntl } from '@/test/render-with-intl';

const { getCredentialSource, getDataSourceMode, getCredential, useSession, actaClient } =
  vi.hoisted(() => ({
    getCredentialSource: vi.fn(),
    getDataSourceMode: vi.fn(),
    getCredential: vi.fn(),
    useSession: vi.fn(),
    actaClient: {},
  }));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@acta-products/acta', () => ({
  getCredentialSource,
  getDataSourceMode,
  useActaClient: () => actaClient,
}));

vi.mock('@/session/session-provider', () => ({ useSession }));

import { CredentialDetailView } from './credential-detail-view';

const ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const DID = `did:stellar:testnet:${ADDRESS}`;

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

function connectedSession() {
  useSession.mockReturnValue({
    status: 'connected',
    address: ADDRESS,
    did: DID,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function disconnectedSession() {
  useSession.mockReturnValue({
    status: 'disconnected',
    address: null,
    did: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

beforeEach(() => {
  getCredential.mockReset();
  getCredentialSource.mockReset().mockReturnValue({ getCredential });
  getDataSourceMode.mockReset().mockReturnValue('mock');
  useSession.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('CredentialDetailView', () => {
  it('shows the connect prompt and never reads the source when disconnected in real mode', async () => {
    getDataSourceMode.mockReturnValue('real');
    disconnectedSession();

    renderWithIntl(<CredentialDetailView id="cred-income" />);

    expect(await screen.findByText('Connect your wallet')).toBeInTheDocument();
    expect(getCredential).not.toHaveBeenCalled();
  });

  it('renders the credential from the connected holder vault in real mode', async () => {
    getDataSourceMode.mockReturnValue('real');
    connectedSession();
    getCredential.mockResolvedValue(CREDENTIAL);

    renderWithIntl(<CredentialDetailView id="cred-income" />);

    expect(await screen.findByText('Anchor Payroll Income')).toBeInTheDocument();
    expect(getCredentialSource).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ADDRESS, holderDid: DID })
    );
  });

  it('reads fixtures with no wallet connected when in mock mode', async () => {
    getDataSourceMode.mockReturnValue('mock');
    disconnectedSession();
    getCredential.mockResolvedValue(CREDENTIAL);

    renderWithIntl(<CredentialDetailView id="cred-income" />);

    expect(await screen.findByText('Anchor Payroll Income')).toBeInTheDocument();
  });

  it('shows the not found state when the credential does not exist', async () => {
    connectedSession();
    getCredential.mockResolvedValue(null);

    renderWithIntl(<CredentialDetailView id="cred-missing" />);

    expect(await screen.findByText('Credential not found')).toBeInTheDocument();
  });
});
