'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { getCredentialSource } from '@acta-products/acta';
import type { CreditCredential } from '@acta-products/acta/types';
import { Button } from '@acta-products/ui';
import { RefreshCw, Inbox, FileQuestion, AlertCircle } from 'lucide-react';
import { categoryOf, statusKindOf } from '@/lib/credentials';
import {
  CredentialFilters,
  type CategoryFilter,
  type StatusFilter,
} from './credential-filters';
import { CredentialCard } from './credential-card';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; credentials: CreditCredential[] };

interface MessagePanelProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function MessagePanel({ icon, title, description, action }: MessagePanelProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function CredentialsView() {
  const t = useTranslations('credentials');

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
          <div
            className="flex flex-col items-center justify-center gap-4 py-20"
            role="status"
            aria-live="polite"
          >
            <RefreshCw className="size-7 animate-spin text-primary" />
            <p className="animate-pulse text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        )}

        {state.phase === 'error' && (
          <MessagePanel
            icon={<AlertCircle className="size-6" />}
            title={t('error.title')}
            description={t('error.description')}
            action={
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={retry}
              >
                <RefreshCw className="size-3.5" />
                {t('error.retry')}
              </Button>
            }
          />
        )}

        {state.phase === 'ready' && state.credentials.length === 0 && (
          <MessagePanel
            icon={<Inbox className="size-6" />}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        )}

        {state.phase === 'ready' && state.credentials.length > 0 && (
          <>
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
                <MessagePanel
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
