'use client';

import * as React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Skeleton,
  StatePanel,
} from '@acta-products/ui';
import { AlertCircle, Link2, RefreshCw } from 'lucide-react';
import {
  listPresentationLinks,
  PresentationLinkError,
  revokePresentationLink,
  type SharedLinkSummary,
} from '@/lib/presentation-link';
import { getWalletConnector, resolveNetworkPassphrase } from '@/session/wallet-connector';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; links: SharedLinkSummary[] };

interface SharedLinksSectionProps {
  did: string;
  address: string;
}

/**
 * Holder-facing list of the share links they created, with revocation (#57).
 * Lives on the vault dashboard rather than under `/share` so it reads as
 * "what I've shared" alongside the rest of the holder's identity — `/share`
 * stays focused on creating a new link.
 */
export function SharedLinksSection({ did, address }: SharedLinksSectionProps) {
  const t = useTranslations('vault.sharedLinks');
  const format = useFormatter();

  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });
  const [reloadKey, setReloadKey] = React.useState(0);
  const [revokingRef, setRevokingRef] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    listPresentationLinks(getWalletConnector(), did, {
      networkPassphrase: resolveNetworkPassphrase(),
      address,
    })
      .then((links) => {
        if (!cancelled) setState({ phase: 'ready', links });
      })
      .catch((err) => {
        console.error('Failed to load shared links', err);
        if (!cancelled) setState({ phase: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [did, address, reloadKey]);

  const retry = () => {
    setState({ phase: 'loading' });
    setReloadKey((k) => k + 1);
  };

  const handleRevoke = async (ref: string) => {
    if (!window.confirm(t('revokeConfirm'))) return;

    setRevokingRef(ref);
    try {
      await revokePresentationLink(getWalletConnector(), ref, did, {
        networkPassphrase: resolveNetworkPassphrase(),
        address,
      });
      setState((prev) =>
        prev.phase === 'ready'
          ? {
              phase: 'ready',
              links: prev.links.map((link) =>
                link.ref === ref ? { ...link, revokedAt: Date.now() } : link
              ),
            }
          : prev
      );
    } catch (err) {
      console.error('Failed to revoke shared link', err);
      alert(err instanceof PresentationLinkError ? err.message : t('revokeError'));
    } finally {
      setRevokingRef(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </CardHeader>
      <CardContent>
        {state.phase === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('loading')}
            className="flex flex-col gap-3"
          >
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}

        {state.phase === 'error' && (
          <StatePanel
            icon={<AlertCircle className="size-6" />}
            title={t('error.title')}
            description={t('error.description')}
            action={
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={retry}>
                <RefreshCw className="size-3.5" />
                {t('error.retry')}
              </Button>
            }
          />
        )}

        {state.phase === 'ready' && state.links.length === 0 && (
          <StatePanel
            icon={<Link2 className="size-6" />}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        )}

        {state.phase === 'ready' && state.links.length > 0 && (
          <ul className="flex flex-col gap-3">
            {state.links.map((link) => {
              const isRevoked = link.revokedAt !== null;
              return (
                <li
                  key={link.ref}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span className="truncate">{link.ref}</span>
                      {isRevoked && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {t('revoked')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t('credentialCount', { count: link.credentialCount })}</span>
                      <span>
                        {t('created')}:{' '}
                        {format.dateTime(new Date(link.createdAt), { dateStyle: 'medium' })}
                      </span>
                      <span>
                        {link.expiresAt
                          ? `${t('expires')}: ${format.dateTime(new Date(link.expiresAt), { dateStyle: 'medium' })}`
                          : null}
                      </span>
                      {isRevoked && link.revokedAt && (
                        <span>{t('revokedAt', { date: new Date(link.revokedAt) })}</span>
                      )}
                    </div>
                  </div>

                  {!isRevoked && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer shrink-0"
                      disabled={revokingRef === link.ref}
                      onClick={() => void handleRevoke(link.ref)}
                    >
                      {revokingRef === link.ref ? t('revoking') : t('revoke')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
