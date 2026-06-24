'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { CreditCredential } from '@acta-products/acta/types';
import { Card, StatusBadge, CategoryIcon, type CredentialStatusKind } from '@acta-products/ui';
import { ChevronRight } from 'lucide-react';
import { categoryOf, statusKindOf, revokedAtOf } from '@/lib/credentials';

function useStatusLabel() {
  const t = useTranslations('credentials.status');

  return (status: CredentialStatusKind, revokedAt?: string): string => {
    if (status === 'revoked') {
      return revokedAt ? t('revoked', { date: new Date(revokedAt) }) : t('revokedNoDate');
    }
    return status === 'invalid' ? t('invalid') : t('valid');
  };
}

interface CredentialCardProps {
  credential: CreditCredential;
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const t = useTranslations('credentials');
  const statusLabel = useStatusLabel();

  const category = categoryOf(credential);
  const status = statusKindOf(credential);
  const revokedAt = revokedAtOf(credential);

  return (
    <Link
      href={`/credentials/${credential.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`${credential.title} — ${t(`category.${category}`)}`}
    >
      <Card className="flex items-center gap-4 p-4 group-hover:border-primary/40 group-hover:shadow-md">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CategoryIcon category={category} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{credential.title}</h3>
            <StatusBadge status={status} label={statusLabel(status, revokedAt)} />
          </div>
          <p className="text-xs font-medium text-primary">{t(`category.${category}`)}</p>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
            <span className="truncate">
              {t('item.issuer')}: <span className="text-foreground/80">{credential.issuer}</span>
            </span>
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span>{t('item.issued', { date: new Date(credential.issueDate) })}</span>
          </div>
        </div>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Card>
    </Link>
  );
}
