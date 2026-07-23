'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { getCredentialSource, useActaClient } from '@acta-products/acta';
import type { CreditCredential, CreditProfileSummary } from '@acta-products/acta/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CopyField,
  ProfileSummaryCard,
  Skeleton,
  StatePanel,
} from '@acta-products/ui';
import { AlertCircle, ArrowRight, Inbox, RefreshCw, Wallet } from 'lucide-react';
import { useSession } from '@/session/session-provider';
import { CREDIT_CATEGORIES } from '@/lib/credentials';
import { computeProfileSummary } from '@/lib/profile-summary';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; profile: CreditProfileSummary; credentials: CreditCredential[] };

function VaultSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

export function VaultView() {
  const t = useTranslations('vault');
  const tSession = useTranslations('session');

  const { status, address, did, connect } = useSession();
  // The ACTA SDK client comes from React context, so it must be read at render
  // and handed to the credential source inside the effect (the hook cannot run
  // in an async callback). The dashboard is session-gated, so the vault owner
  // (G… address) is available directly from the session — no DID parsing needed.
  const actaClient = useActaClient();

  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (status !== 'connected' || !address) return;

    let cancelled = false;

    const source = getCredentialSource({
      owner: address,
      holderDid: did ?? undefined,
      client: actaClient,
    });

    Promise.all([source.getProfileSummary(), source.listCredentials()])
      .then(([profile, credentials]) => {
        if (!cancelled) setState({ phase: 'ready', profile, credentials });
      })
      .catch((err) => {
        console.error('Failed to load vault', err);
        if (!cancelled) setState({ phase: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [status, address, did, actaClient, reloadKey]);

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

        {status === 'disconnected' && (
          <StatePanel
            icon={<Wallet className="size-6" />}
            title={t('connect.title')}
            description={t('connect.description')}
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
        )}

        {status === 'connecting' && (
          <div role="status" aria-live="polite" aria-label={tSession('connecting')}>
            <VaultSkeleton />
          </div>
        )}

        {status === 'connected' && (
          <>
            {state.phase === 'loading' && (
              <div role="status" aria-live="polite" aria-label={t('loading')}>
                <VaultSkeleton />
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

            {state.phase === 'ready' && state.credentials.length === 0 && (
              <StatePanel
                icon={<Inbox className="size-6" />}
                title={t('empty.title')}
                description={t('empty.description')}
              />
            )}

            {state.phase === 'ready' && state.credentials.length > 0 && (
              <VaultDashboard
                profile={state.profile}
                credentials={state.credentials}
                did={did ?? state.profile.holderDid}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

interface VaultDashboardProps {
  profile: CreditProfileSummary;
  credentials: CreditCredential[];
  did: string;
}

function VaultDashboard({ profile, credentials, did }: VaultDashboardProps) {
  const t = useTranslations('vault');
  const tCredentials = useTranslations('credentials');
  const format = useFormatter();

  const summary = React.useMemo(() => computeProfileSummary(credentials), [credentials]);
  const noValue = t('noValue');

  const stats = [
    {
      label: t('summary.stats.score'),
      value: profile.averageScore != null ? format.number(profile.averageScore) : noValue,
    },
    {
      label: t('summary.stats.activeCredentials'),
      value: format.number(profile.activeCredentialsCount),
    },
    {
      label: t('summary.stats.repaidLoans'),
      value: profile.totalLoansRepaid != null ? format.number(profile.totalLoansRepaid) : noValue,
    },
    {
      label: t('summary.stats.riskCategory'),
      value: profile.riskCategory ? t(`risk.${profile.riskCategory}`) : noValue,
    },
    {
      label: t('summary.stats.historySince'),
      value: summary.oldestIssuedAt
        ? format.dateTime(new Date(summary.oldestIssuedAt), { year: 'numeric', month: 'short' })
        : noValue,
    },
  ];

  return (
    <>
      <ProfileSummaryCard
        title={t('summary.title')}
        disclaimer={t('summary.disclaimer')}
        stats={stats}
        categoriesTitle={t('summary.categoriesTitle')}
        categories={CREDIT_CATEGORIES.map((category) => ({
          category,
          label: tCredentials(`category.${category}`),
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

      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-base font-semibold">{t('identity.title')}</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{t('identity.name')}</dt>
              <dd className="text-sm font-semibold">{profile.holderName}</dd>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <dt className="text-xs text-muted-foreground">{t('identity.did')}</dt>
              <dd>
                <CopyField value={did} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button asChild variant="outline" className="cursor-pointer">
          <Link href="/credentials">
            {t('viewCredentials')}
            <ArrowRight className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </div>
    </>
  );
}
