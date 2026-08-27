import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import { renderWithIntl } from '@/test/render-with-intl';

const { getCredentialSource, getProfileSummary, listCredentials, useSession, actaClient } =
  vi.hoisted(() => ({
    getCredentialSource: vi.fn(),
    getProfileSummary: vi.fn(),
    listCredentials: vi.fn(),
    useSession: vi.fn(),
    // Stable reference, mirroring the memoized ActaConfig context in the app —
    // an unstable client would retrigger the load effect on every render.
    actaClient: {},
  }));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@acta-products/acta', () => ({
  getCredentialSource,
  useActaClient: () => actaClient,
}));

vi.mock('@/session/session-provider', () => ({ useSession }));

// Shared links has its own dedicated test file — stub it here so this suite
// stays focused on VaultView's own load/error/empty states and doesn't pull
// in the wallet connector module (which this suite never mocks).
vi.mock('@/components/vault/shared-links-section', () => ({
  SharedLinksSection: () => null,
}));

import { VaultView } from './vault-view';

const ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const DID = `did:stellar:testnet:${ADDRESS}`;

const CREDENTIAL: CreditCredential = {
  id: 'cred-income',
  type: 'IncomeVerification',
  title: 'Anchor Payroll Income',
  issuer: 'Stellar Anchor Payroll Services',
  issuerDid: 'did:stellar:mainnet:GAPAYROLL',
  issueDate: '2026-03-01T14:15:00Z',
  value: 720,
  description: 'Verified salary.',
  status: 'valid',
  claims: { annualSalaryUSD: 45000 },
};

const PROFILE: CreditProfileSummary = {
  holderDid: DID,
  holderName: 'Alex Mercer',
  averageScore: 720,
  activeCredentialsCount: 1,
  totalLoansRepaid: 0,
  riskCategory: 'Medium',
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
  getProfileSummary.mockReset().mockResolvedValue(PROFILE);
  listCredentials.mockReset().mockResolvedValue([CREDENTIAL]);
  getCredentialSource.mockReset().mockReturnValue({ getProfileSummary, listCredentials });
  useSession.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('VaultView', () => {
  it('shows the connect prompt and reads no data when disconnected', async () => {
    disconnectedSession();

    renderWithIntl(<VaultView />);

    expect(await screen.findByText('Connect your wallet')).toBeInTheDocument();
    expect(getProfileSummary).not.toHaveBeenCalled();
  });

  it('renders the profile summary from the data source when connected', async () => {
    connectedSession();

    renderWithIntl(<VaultView />);

    expect(await screen.findByText('Credit profile summary')).toBeInTheDocument();
    // The vault is keyed by the owner (G… address) taken from the session.
    expect(getCredentialSource).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ADDRESS, holderDid: DID })
    );
    // Holder DID renders in did:stellar form.
    expect(screen.getByText(DID)).toBeInTheDocument();
  });

  it('shows the empty state when the holder has no credentials', async () => {
    connectedSession();
    listCredentials.mockResolvedValue([]);

    renderWithIntl(<VaultView />);

    expect(await screen.findByText('No credentials yet')).toBeInTheDocument();
  });

  it('shows the error state with a retry when loading fails', async () => {
    connectedSession();
    getProfileSummary.mockRejectedValue(new Error('boom'));

    renderWithIntl(<VaultView />);

    expect(await screen.findByText("Couldn't load your vault")).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });
});
