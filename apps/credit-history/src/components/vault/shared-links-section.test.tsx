import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIntl } from '@/test/render-with-intl';
import type { SharedLinkSummary } from '@/lib/presentation-link';

const { listPresentationLinks, revokePresentationLink, getWalletConnector } = vi.hoisted(() => ({
  listPresentationLinks: vi.fn(),
  revokePresentationLink: vi.fn(),
  getWalletConnector: vi.fn(() => ({})),
}));

vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));

vi.mock('@/lib/presentation-link', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/presentation-link')>('@/lib/presentation-link');
  return { ...actual, listPresentationLinks, revokePresentationLink };
});

vi.mock('@/session/wallet-connector', () => ({
  getWalletConnector,
  resolveNetworkPassphrase: () => 'Test SDF Network ; September 2015',
}));

import { SharedLinksSection } from './shared-links-section';

const DID = 'did:stellar:testnet:GHOLDER';
const ADDRESS = 'GHOLDER';

const ACTIVE_LINK: SharedLinkSummary = {
  ref: 'ref-active',
  credentialCount: 2,
  createdAt: Date.parse('2026-01-01T00:00:00Z'),
  expiresAt: null,
  revokedAt: null,
};

beforeEach(() => {
  listPresentationLinks.mockReset();
  revokePresentationLink.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SharedLinksSection', () => {
  it('shows the empty state when the holder has no links', async () => {
    listPresentationLinks.mockResolvedValue([]);

    renderWithIntl(<SharedLinksSection did={DID} address={ADDRESS} />);

    expect(await screen.findByText('No shared links yet')).toBeInTheDocument();
  });

  it('shows the error state with a retry when loading fails', async () => {
    listPresentationLinks.mockRejectedValue(new Error('boom'));

    renderWithIntl(<SharedLinksSection did={DID} address={ADDRESS} />);

    expect(await screen.findByText("Couldn't load your shared links")).toBeInTheDocument();
  });

  it('lists active links and revokes one after confirmation', async () => {
    listPresentationLinks.mockResolvedValue([ACTIVE_LINK]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithIntl(<SharedLinksSection did={DID} address={ADDRESS} />);

    expect(await screen.findByText('ref-active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(revokePresentationLink).toHaveBeenCalledWith(
        expect.anything(),
        'ref-active',
        DID,
        expect.objectContaining({ address: ADDRESS })
      )
    );
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
  });

  it('does not revoke when the confirmation is declined', async () => {
    listPresentationLinks.mockResolvedValue([ACTIVE_LINK]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithIntl(<SharedLinksSection did={DID} address={ADDRESS} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    expect(revokePresentationLink).not.toHaveBeenCalled();
  });
});
