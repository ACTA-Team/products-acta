'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { getCredentialSource, parseDidStellar, useActaClient } from '@acta-products/acta';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import type { ProofVerification } from '@acta-products/acta/presentation';
import {
  AttributionNote,
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
  type AttributionStatus,
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
import { resolvePresentationRef } from '@/lib/presentation-link';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'invalid'; reason: 'malformed' | 'expired'; expirationDate?: Date }
  | {
      phase: 'ready';
      credentials: CreditCredential[];
      profile: CreditProfileSummary;
      expirationDate: Date | null;
      proof: ProofVerification;
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

function useAttributionCopy() {
  const t = useTranslations('verify.attribution');

  return (
    proof: ProofVerification
  ): { status: AttributionStatus; title: string; description: string } => {
    if (proof.status === 'signed') {
      return { status: 'signed', title: t('title'), description: t('description') };
    }
    if (proof.status === 'unsigned') {
      return {
        status: 'unsigned',
        title: t('unsignedTitle'),
        description: t('unsignedDescription'),
      };
    }
    return {
      status: 'mismatch',
      title: t('mismatchTitle'),
      description: t('mismatchDescription'),
    };
  };
}

interface PublicVerificationViewProps {
  token: string;
}

export function PublicVerificationView({ token }: PublicVerificationViewProps) {
  const t = useTranslations('verify');
  const tCredentials = useTranslations('credentials');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const statusLabel = useStatusLabel();

  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });

  // The ACTA SDK client is only obtainable via this hook (React context), so we
  // read it at render and hand it to the credential source inside the effect —
  // `getCredentialSource` cannot call the hook from within an async callback.
  const actaClient = useActaClient();

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
      // The URL only carries an opaque reference — the presentation itself
      // (credential ids, holder, expiration, holder proof) is resolved from the
      // server, which is also where expiration is enforced. Nothing here can be
      // bypassed by editing the link.
      const resolution = await resolvePresentationRef(token);

      if (resolution.status === 'not_found') {
        if (!cancelled) setState({ phase: 'invalid', reason: 'malformed' });
        return;
      }

      if (resolution.status === 'expired') {
        if (!cancelled) {
          setState({
            phase: 'invalid',
            reason: 'expired',
            expirationDate: new Date(resolution.expiresAt),
          });
        }
        return;
      }

      const { presentation, proof } = resolution;
      const expiresAt = presentation.expires ? Date.parse(presentation.expires) : null;
      const expirationDate = expiresAt === null ? null : new Date(expiresAt);

      try {
        // Each credential in the presentation is verified on-chain by RPC against
        // the vc-vault: getCredential -> vaultVerify returns ONLY 'valid' | 'revoked',
        // which drives the per-credential and overall banner status. The 'invalid'
        // state (a shared credential the vault cannot return / verify) is decided
        // here, not by the contract. The owner (G… address) the vault is keyed by
        // is derived from the presentation's holder did:stellar.
        const owner = parseDidStellar(presentation.holder)?.address ?? null;
        const source = owner
          ? getCredentialSource({ owner, holderDid: presentation.holder, client: actaClient })
          : getCredentialSource();

        const [profile, resolved] = await Promise.all([
          source.getProfileSummary(),
          Promise.all(presentation.verifiableCredential.map((id) => source.getCredential(id))),
        ]);

        // Any shared credential the vault cannot return / verify makes the whole
        // presentation untrustworthy — surface it as invalid rather than silently
        // dropping it and reporting a partial "valid" set.
        const credentials = resolved.filter((c): c is CreditCredential => c !== null);
        if (credentials.length === 0 || credentials.length !== resolved.length) {
          if (!cancelled) setState({ phase: 'invalid', reason: 'malformed' });
          return;
        }

        if (!cancelled) {
          setState({
            phase: 'ready',
            credentials,
            // The holder DID shown to the verifier comes from the stored
            // presentation, not from the vault read — it is the identity the
            // presentation was created (and proved) under.
            profile: { ...profile, holderDid: presentation.holder || profile.holderDid },
            expirationDate,
            // Attribution is verified server-side (see /api/presentations/[ref])
            // and never influences credential status — it's rendered as an
            // independent signal below.
            proof,
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
  }, [token, actaClient]);

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

            <div className="flex flex-col gap-2">
              <AttributionSection proof={state.proof} />
              <p className="px-1 text-xs text-muted-foreground">{t('attribution.whatThisMeans')}</p>
            </div>

            <header className="flex flex-col gap-4 border-b border-border/80 pb-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {t('title')}
                </h1>
                <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
              </div>
              <div className="flex w-full max-w-full shrink flex-col gap-1 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 font-mono text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0">{t('expiration')}:</span>
                <span className="min-w-0 break-words font-semibold text-foreground">
                  {state.expirationDate
                    ? format.dateTime(state.expirationDate, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : t('neverExpires')}
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

function AttributionSection({ proof }: { proof: ProofVerification }) {
  const attributionCopy = useAttributionCopy();
  const { status, title, description } = attributionCopy(proof);
  return <AttributionNote status={status} title={title} description={description} />;
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