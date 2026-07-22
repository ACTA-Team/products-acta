import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render-with-intl';

const { listCredentials } = vi.hoisted(() => ({ listCredentials: vi.fn() }));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@acta-products/acta', () => ({
  getCredentialSource: () => ({ listCredentials }),
}));

vi.mock('@/session/session-provider', () => ({
  useSession: () => ({
    status: 'connected',
    address: null,
    did: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

import { CredentialsView } from './credentials-view';

beforeEach(() => {
  listCredentials.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('CredentialsView states', () => {
  it('shows the loading skeleton while the fetch is pending', () => {
    listCredentials.mockReturnValue(new Promise(() => {}));
    renderWithIntl(<CredentialsView />);
    expect(screen.getByRole('status', { name: 'Loading your credentials…' })).toBeInTheDocument();
  });

  it('shows the empty state when no credentials are returned', async () => {
    listCredentials.mockResolvedValue([]);
    renderWithIntl(<CredentialsView />);
    expect(await screen.findByText('No credentials yet')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the error state with a retry action when the fetch rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    listCredentials.mockRejectedValue(new Error('boom'));
    renderWithIntl(<CredentialsView />);
    expect(await screen.findByText("Couldn't load your credentials")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
