'use client';

import { useTranslations } from 'next-intl';
import type { CredentialStatusKind } from '@acta-products/ui';
import { Button, cn } from '@acta-products/ui';
import { X } from 'lucide-react';
import type { CreditCategory } from '@acta-products/acta/types';
import { CREDIT_CATEGORIES, CREDENTIAL_STATUSES } from '@/lib/credentials';

export type CategoryFilter = CreditCategory | 'all';
export type StatusFilter = CredentialStatusKind | 'all';

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterPill({ active, onClick, children }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

interface CredentialFiltersProps {
  category: CategoryFilter;
  status: StatusFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onClear: () => void;
}

export function CredentialFilters({
  category,
  status,
  onCategoryChange,
  onStatusChange,
  onClear,
}: CredentialFiltersProps) {
  const t = useTranslations('credentials');
  const hasActiveFilters = category !== 'all' || status !== 'all';

  // Short status labels (no date) for the filter pills.
  const statusLabel = (value: CredentialStatusKind): string =>
    value === 'revoked'
      ? t('status.revokedNoDate')
      : value === 'invalid'
        ? t('status.invalid')
        : t('status.valid');

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('filters.category')}
        </legend>
        <div className="flex flex-wrap gap-2">
          <FilterPill active={category === 'all'} onClick={() => onCategoryChange('all')}>
            {t('filters.all')}
          </FilterPill>
          {CREDIT_CATEGORIES.map((value) => (
            <FilterPill
              key={value}
              active={category === value}
              onClick={() => onCategoryChange(value)}
            >
              {t(`category.${value}`)}
            </FilterPill>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('filters.status')}
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={status === 'all'} onClick={() => onStatusChange('all')}>
            {t('filters.all')}
          </FilterPill>
          {CREDENTIAL_STATUSES.map((value) => (
            <FilterPill key={value} active={status === value} onClick={() => onStatusChange(value)}>
              {statusLabel(value)}
            </FilterPill>
          ))}

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="ml-auto cursor-pointer text-muted-foreground"
            >
              <X className="size-3.5" />
              {t('filters.clear')}
            </Button>
          )}
        </div>
      </fieldset>
    </div>
  );
}
