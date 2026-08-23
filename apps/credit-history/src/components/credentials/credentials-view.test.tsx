import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render-with-intl';

const { getCredentialSource, getDataSourceMode, listCredentials, useSession, actaClient } =
  vi.hoisted(() => ({
    getCredentialSource: vi.fn(),
    getDataSourceMode: vi.fn(),
    listCredentials: vi.fn(),
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

import { CredentialsView } from './credentials-view';

const ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const DID = `did:stellar:testnet:${ADDRESS}`;

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
  listCredentials.mockReset();
  getCredentialSource.mockReset().mockReturnValue({ listCredentials });
  getDataSourceMode.mockReset().mockReturnValue('mock');
  useSession.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('CredentialsView states', () => {
  it('shows the loading skeleton while the fetch is pending', () => {
    connectedSession();
    listCredentials.mockReturnValue(new Promise(() => {}));
    renderWithIntl(<CredentialsView />);
    expect(screen.getByRole('status', { name: 'Loading your credentials…' })).toBeInTheDocument();
  });

  it('shows the empty state when no credentials are returned', async () => {
    connectedSession();
    listCredentials.mockResolvedValue([]);
    renderWithIntl(<CredentialsView />);
    expect(await screen.findByText('No credentials yet')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the error state with a retry action when the fetch rejects', async () => {
    connectedSession();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    listCredentials.mockRejectedValue(new Error('boom'));
    renderWithIntl(<CredentialsView />);
    expect(await screen.findByText("Couldn't load your credentials")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('reads fixtures with no wallet connected when in mock mode', async () => {
    getDataSourceMode.mockReturnValue('mock');
    disconnectedSession();
    listCredentials.mockResolvedValue([]);

    renderWithIntl(<CredentialsView />);

    expect(await screen.findByText('No credentials yet')).toBeInTheDocument();
    expect(getCredentialSource).toHaveBeenCalled();
  });

  it('shows the connect prompt and never reads the source when disconnected in real mode', async () => {
    getDataSourceMode.mockReturnValue('real');
    disconnectedSession();

    renderWithIntl(<CredentialsView />);

    expect(await screen.findByText('Connect your wallet')).toBeInTheDocument();
    expect(listCredentials).not.toHaveBeenCalled();
  });

  it('reads the connected holder vault when in real mode', async () => {
    getDataSourceMode.mockReturnValue('real');
    connectedSession();
    listCredentials.mockResolvedValue([]);

    renderWithIntl(<CredentialsView />);

    await screen.findByText('No credentials yet');
    expect(getCredentialSource).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ADDRESS, holderDid: DID })
    );
  });
});
