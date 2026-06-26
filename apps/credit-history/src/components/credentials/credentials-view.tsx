'use client';

import * as React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { getCredentialSource } from '@acta-products/acta';
import type { CreditCredential } from '@acta-products/acta/types';
import { Button, Card, ProfileSummaryCard, Skeleton, StatePanel } from '@acta-products/ui';
import { RefreshCw, Inbox, FileQuestion, AlertCircle, Wallet } from 'lucide-react';
import { useSession } from '@/session/session-provider';
import { CREDIT_CATEGORIES, categoryOf, statusKindOf } from '@/lib/credentials';
import { computeProfileSummary } from '@/lib/profile-summary';
import { CredentialFilters, type CategoryFilter, type StatusFilter } from './credential-filters';
import { CredentialCard } from './credential-card';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; credentials: CreditCredential[] };

function CredentialListSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="flex items-center gap-4 p-4">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="size-4 shrink-0 rounded-sm" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CredentialsView() {
  const t = useTranslations('credentials');
  const tSession = useTranslations('session');
  const format = useFormatter();
  const { status: sessionStatus, connect } = useSession();

  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [status, setStatus] = React.useState<StatusFilter>('all');
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    getCredentialSource()
      .listCredentials()
      .then((credentials) => {
        if (!cancelled) setState({ phase: 'ready', credentials });
      })
      .catch((err) => {
        console.error('Failed to load credentials', err);
        if (!cancelled) setState({ phase: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Client-side filtering over the already-fetched list (mock returns the full
  // set). Category AND status are combined with AND semantics.
  const filtered = React.useMemo(() => {
    if (state.phase !== 'ready') return [];
    return state.credentials.filter((credential) => {
      const categoryMatch = category === 'all' || categoryOf(credential) === category;
      const statusMatch = status === 'all' || statusKindOf(credential) === status;
      return categoryMatch && statusMatch;
    });
  }, [state, category, status]);

  const summary = React.useMemo(
    () => (state.phase === 'ready' ? computeProfileSummary(state.credentials) : null),
    [state]
  );

  const clearFilters = () => {
    setCategory('all');
    setStatus('all');
  };

  const retry = () => {
    setState({ phase: 'loading' });
    setReloadKey((k) => k + 1);
  };

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 md:py-14">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </header>

        {state.phase === 'loading' && (
          <div role="status" aria-live="polite" aria-label={t('loading')}>
            <CredentialListSkeleton />
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

        {state.phase === 'ready' &&
          state.credentials.length === 0 &&
          (sessionStatus === 'disconnected' ? (
            <StatePanel
              icon={<Wallet className="size-6" />}
              title={t('empty.connectTitle')}
              description={t('empty.connectDescription')}
              action={
                <Button
                  size="sm"
                  className="cursor-pointer gap-1.5"
                  onClick={() => connect().catch(console.error)}
                >
                  <Wallet className="size-3.5" />
                  {tSession('connect')}
                </Button>
              }
            />
          ) : (
            <StatePanel
              icon={<Inbox className="size-6" />}
              title={t('empty.title')}
              description={t('empty.description')}
            />
          ))}

        {state.phase === 'ready' && state.credentials.length > 0 && (
          <>
            {summary && (
              <ProfileSummaryCard
                title={t('summary.title')}
                disclaimer={t('summary.disclaimer')}
                stats={[
                  { label: t('summary.stats.total'), value: String(state.credentials.length) },
                  { label: t('summary.stats.valid'), value: String(summary.counts.valid) },
                  { label: t('summary.stats.revoked'), value: String(summary.counts.revoked) },
                  {
                    label: t('summary.stats.historySince'),
                    value: summary.oldestIssuedAt
                      ? format.dateTime(new Date(summary.oldestIssuedAt), {
                          year: 'numeric',
                          month: 'short',
                        })
                      : '—',
                  },
                ]}
                categoriesTitle={t('summary.categoriesTitle')}
                categories={CREDIT_CATEGORIES.map((category) => ({
                  category,
                  label: t(`category.${category}`),
                  count: summary.totalsByCategory[category],
                }))}
                timeline={
                  summary.oldestIssuedAt
                    ? {
                        startLabel: format.dateTime(new Date(summary.oldestIssuedAt), {
                          year: 'numeric',
                          month: 'short',
                        }),
                        endLabel: t('summary.timeline.today'),
                        caption: t('summary.timeline.caption'),
                      }
                    : undefined
                }
              />
            )}

            <CredentialFilters
              category={category}
              status={status}
              onCategoryChange={setCategory}
              onStatusChange={setStatus}
              onClear={clearFilters}
            />

            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {t('results', { count: filtered.length })}
              </p>

              {filtered.length === 0 ? (
                <StatePanel
                  icon={<FileQuestion className="size-6" />}
                  title={t('emptyFiltered.title')}
                  description={t('emptyFiltered.description')}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={clearFilters}
                    >
                      {t('filters.clear')}
                    </Button>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {filtered.map((credential) => (
                    <li key={credential.id}>
                      <CredentialCard credential={credential} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
