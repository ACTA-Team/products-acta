'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCredentialSource } from '@acta-products/acta';
import type { CreditCredential } from '@acta-products/acta/types';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CategoryIcon,
  CopyField,
  Skeleton,
  StatePanel,
  StatusBadge,
  type CredentialStatusKind,
} from '@acta-products/ui';
import { AlertCircle, ArrowLeft, FileQuestion, RefreshCw, Share2 } from 'lucide-react';
import {
  categoryOf,
  detailClaimEntries,
  formatClaimValue,
  humanizeClaimKey,
  revokedAtOf,
  statusKindOf,
} from '@/lib/credentials';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'notFound' }
  | { phase: 'ready'; credential: CreditCredential };

function CredentialDetailSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <Skeleton className="size-12 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-56 max-w-full" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-16" />
          <div className="divide-y divide-border rounded-lg border border-border">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
        <Skeleton className="h-10 w-full rounded-md sm:w-32" />
      </CardFooter>
    </Card>
  );
}

function useStatusLabel() {
  const t = useTranslations('credentials.status');

  return (status: CredentialStatusKind, revokedAt?: string): string => {
    if (status === 'revoked') {
      return revokedAt ? t('revoked', { date: new Date(revokedAt) }) : t('revokedNoDate');
    }
    return status === 'invalid' ? t('invalid') : t('valid');
  };
}

interface CredentialDetailViewProps {
  id: string;
}

export function CredentialDetailView({ id }: CredentialDetailViewProps) {
  const t = useTranslations('credentials');
  const tCommon = useTranslations('common');
  const statusLabel = useStatusLabel();

  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    getCredentialSource()
      .getCredential(id)
      .then((credential) => {
        if (cancelled) return;
        if (!credential) {
          setState({ phase: 'notFound' });
          return;
        }
        setState({ phase: 'ready', credential });
      })
      .catch((err) => {
        console.error('Failed to load credential', err);
        if (!cancelled) setState({ phase: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const retry = () => {
    setState({ phase: 'loading' });
    setReloadKey((k) => k + 1);
  };

  const formatOptions = React.useMemo(
    () => ({
      yesLabel: tCommon('yes'),
      noLabel: tCommon('no'),
    }),
    [tCommon]
  );

  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 md:py-14">
      <div className="flex flex-col gap-6">
        <Link
          href="/credentials"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('detail.back')}
        </Link>

        {state.phase === 'loading' && (
          <div role="status" aria-live="polite" aria-label={t('detail.loadingDetail')}>
            <CredentialDetailSkeleton />
          </div>
        )}

        {state.phase === 'error' && (
          <StatePanel
            icon={<AlertCircle className="size-6" />}
            title={t('detail.error.title')}
            description={t('detail.error.description')}
            action={
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={retry}>
                <RefreshCw className="size-3.5" />
                {t('detail.error.retry')}
              </Button>
            }
          />
        )}

        {state.phase === 'notFound' && (
          <StatePanel
            icon={<FileQuestion className="size-6" />}
            title={t('detail.notFound.title')}
            description={t('detail.notFound.description')}
            action={
              <div className="flex flex-col items-center gap-3">
                <StatusBadge status="invalid" label={t('status.invalid')} />
                <Button asChild variant="outline" size="sm" className="cursor-pointer">
                  <Link href="/credentials">{t('detail.back')}</Link>
                </Button>
              </div>
            }
          />
        )}

        {state.phase === 'ready' && (
          <CredentialDetailContent
            credential={state.credential}
            statusLabel={statusLabel}
            formatOptions={formatOptions}
            t={t}
          />
        )}
      </div>
    </section>
  );
}

interface CredentialDetailContentProps {
  credential: CreditCredential;
  statusLabel: (status: CredentialStatusKind, revokedAt?: string) => string;
  formatOptions: { yesLabel: string; noLabel: string };
  t: ReturnType<typeof useTranslations<'credentials'>>;
}

function CredentialDetailContent({
  credential,
  statusLabel,
  formatOptions,
  t,
}: CredentialDetailContentProps) {
  const category = categoryOf(credential);
  const status = statusKindOf(credential);
  const revokedAt = revokedAtOf(credential);
  const claimEntries = detailClaimEntries(credential.claims ?? {});

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CategoryIcon category={category} className="size-6" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {t(`category.${category}`)}
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {credential.title}
              </h1>
              {credential.description ? (
                <p className="text-sm text-muted-foreground">{credential.description}</p>
              ) : null}
            </div>
          </div>
          <StatusBadge status={status} label={statusLabel(status, revokedAt)} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 pt-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('item.issuer')}
            </dt>
            <dd className="text-sm font-medium text-foreground">{credential.issuer}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="sr-only">
              {t('item.issued', { date: new Date(credential.issueDate) })}
            </dt>
            <dd className="text-sm text-foreground">
              {t('item.issued', { date: new Date(credential.issueDate) })}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('detail.issuerDid')}
          </h2>
          <CopyField value={credential.issuerDid} />
        </div>

        {claimEntries.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('detail.claims')}
            </h2>
            <dl className="divide-y divide-border rounded-lg border border-border">
              {claimEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4"
                >
                  <dt className="text-sm font-medium text-muted-foreground">
                    {humanizeClaimKey(key)}
                  </dt>
                  <dd className="text-sm text-foreground break-words">
                    {formatClaimValue(value, formatOptions)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
        <Button asChild className="w-full cursor-pointer sm:w-auto">
          <Link href={`/share?credential=${credential.id}`}>
            <Share2 className="size-4" />
            {t('detail.share')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
