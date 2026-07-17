'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCredentialSource } from '@acta-products/acta';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CategoryIcon,
  CopyField,
  Skeleton,
  StatePanel,
  StatusBadge,
  VerificationBanner,
  type CredentialStatusKind,
} from '@acta-products/ui';
import { ShieldAlert } from 'lucide-react';
import {
  categoryOf,
  detailClaimEntries,
  formatClaimValue,
  humanizeClaimKey,
  revokedAtOf,
  statusKindOf,
} from '@/lib/credentials';
import { decodePresentationToken } from '@/lib/presentation-token';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'invalid'; reason: 'malformed' | 'expired'; expirationDate?: Date }
  | {
      phase: 'ready';
      credentials: CreditCredential[];
      profile: CreditProfileSummary;
      expirationDate: Date | null;
    };

function VerificationSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex flex-col gap-4 border-b border-border/80 pb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
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

function overallPresentationStatus(credentials: CreditCredential[]): CredentialStatusKind {
  if (credentials.some((c) => c.status === 'revoked')) return 'revoked';
  return 'valid';
}

interface PublicVerificationViewProps {
  token: string;
}

export function PublicVerificationView({ token }: PublicVerificationViewProps) {
  const t = useTranslations('verify');
  const tCredentials = useTranslations('credentials');
  const tCommon = useTranslations('common');
  const statusLabel = useStatusLabel();

  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });

  const formatOptions = React.useMemo(
    () => ({
      yesLabel: tCommon('yes'),
      noLabel: tCommon('no'),
    }),
    [tCommon]
  );

  React.useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const payload = decodePresentationToken(token);
      if (!payload) {
        if (!cancelled) setState({ phase: 'invalid', reason: 'malformed' });
        return;
      }

      if (payload.exp && Date.now() > payload.exp) {
        if (!cancelled) {
          setState({
            phase: 'invalid',
            reason: 'expired',
            expirationDate: new Date(payload.exp),
          });
        }
        return;
      }

      const expirationDate = payload.exp ? new Date(payload.exp) : null;

      try {
        // SEAM: this is where the SDK verification will be called by RPC against the vc-vault.
        // NOTE: verifyVc returns ONLY 'valid' | 'revoked'. The 'invalid' state (not found /
        // not verifiable) is decided by this view, not by the contract.
        const source = getCredentialSource();
        const [allCredentials, profile] = await Promise.all([
          source.listCredentials(),
          source.getProfileSummary(),
        ]);

        const credentials = allCredentials.filter((c) => payload.ids.includes(c.id));

        if (credentials.length === 0) {
          if (!cancelled) setState({ phase: 'invalid', reason: 'malformed' });
          return;
        }

        if (!cancelled) {
          setState({
            phase: 'ready',
            credentials,
            profile,
            expirationDate,
          });
        }
      } catch (err) {
        console.error('Error in verification flow', err);
        if (!cancelled) setState({ phase: 'invalid', reason: 'malformed' });
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 md:py-14">
      <div className="flex flex-col gap-8">
        {state.phase === 'loading' && (
          <div role="status" aria-live="polite" aria-label={t('loading')}>
            <VerificationSkeleton />
          </div>
        )}

        {state.phase === 'invalid' && (
          <>
            <VerificationBanner
              status="invalid"
              title={t('banner.invalid.title')}
              description={t('banner.invalid.description')}
            />
            <StatePanel
              icon={<ShieldAlert className="size-6" />}
              title={t('invalid.title')}
              description={
                state.reason === 'expired' && state.expirationDate
                  ? t('invalid.expiredDescription', { date: state.expirationDate })
                  : t('invalid.description')
              }
              action={
                <div className="flex flex-col items-center gap-3">
                  <StatusBadge status="invalid" label={tCredentials('status.invalid')} />
                  <Button asChild variant="outline" size="sm" className="cursor-pointer">
                    <Link href="/">{t('backToApp')}</Link>
                  </Button>
                </div>
              }
            />
          </>
        )}

        {state.phase === 'ready' && (
          <>
            <VerificationBanner
              status={overallPresentationStatus(state.credentials)}
              title={
                overallPresentationStatus(state.credentials) === 'revoked'
                  ? t('banner.revoked.title')
                  : t('banner.valid.title')
              }
              description={
                overallPresentationStatus(state.credentials) === 'revoked'
                  ? t('banner.revoked.description')
                  : t('banner.valid.description')
              }
            />

            <header className="flex flex-col gap-4 border-b border-border/80 pb-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('title')}
                </h1>
                <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <span>{t('expiration')}:</span>
                <span className="font-semibold text-foreground">
                  {state.expirationDate ? state.expirationDate.toLocaleString() : t('neverExpires')}
                </span>
              </div>
            </header>

            <Card>
              <CardHeader className="pb-4">
                <h2 className="text-base font-semibold">{t('holderInfo')}</h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">{t('holderName')}</dt>
                    <dd className="text-sm font-semibold">{state.profile.holderName}</dd>
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <dt className="text-xs text-muted-foreground">{t('holderDid')}</dt>
                    <dd>
                      <CopyField value={state.profile.holderDid} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <h2 className="px-1 text-base font-bold text-foreground">
                {t('credentialsIncluded')} ({state.credentials.length})
              </h2>

              <ul className="flex flex-col gap-4">
                {state.credentials.map((credential) => (
                  <VerifiedCredentialCard
                    key={credential.id}
                    credential={credential}
                    statusLabel={statusLabel}
                    formatOptions={formatOptions}
                    tCredentials={tCredentials}
                    claimsLabel={t('claims')}
                  />
                ))}
              </ul>
            </div>

            <div className="flex justify-center">
              <Button asChild variant="outline" className="cursor-pointer">
                <Link href="/">{t('backToApp')}</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

interface VerifiedCredentialCardProps {
  credential: CreditCredential;
  statusLabel: (status: CredentialStatusKind, revokedAt?: string) => string;
  formatOptions: { yesLabel: string; noLabel: string };
  tCredentials: ReturnType<typeof useTranslations<'credentials'>>;
  claimsLabel: string;
}

function VerifiedCredentialCard({
  credential,
  statusLabel,
  formatOptions,
  tCredentials,
  claimsLabel,
}: VerifiedCredentialCardProps) {
  const category = categoryOf(credential);
  const status = statusKindOf(credential);
  const revokedAt = revokedAtOf(credential);
  const claimEntries = detailClaimEntries(credential.claims ?? {});

  return (
    <li>
      <Card className={status === 'revoked' ? 'border-st-revoked/20' : undefined}>
        <CardHeader className="gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CategoryIcon category={category} className="size-5" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {tCredentials(`category.${category}`)}
                </p>
                <h3 className="text-base font-semibold text-foreground">{credential.title}</h3>
                {credential.description ? (
                  <p className="text-xs text-muted-foreground">{credential.description}</p>
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
                {tCredentials('item.issuer')}
              </dt>
              <dd className="text-sm font-medium text-foreground">{credential.issuer}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="sr-only">
                {tCredentials('item.issued', { date: new Date(credential.issueDate) })}
              </dt>
              <dd className="text-sm text-foreground">
                {tCredentials('item.issued', { date: new Date(credential.issueDate) })}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tCredentials('detail.issuerDid')}
            </h4>
            <CopyField value={credential.issuerDid} />
          </div>

          {claimEntries.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {claimsLabel}
              </h4>
              <dl className="divide-y divide-border rounded-lg border border-border">
                {claimEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4"
                  >
                    <dt className="text-sm font-medium text-muted-foreground">
                      {humanizeClaimKey(key)}
                    </dt>
                    <dd className="break-words text-sm text-foreground">
                      {formatClaimValue(value, formatOptions)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
