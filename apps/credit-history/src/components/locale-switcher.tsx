'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { setLocale } from '@/actions/locale';
import type { Locale } from '@/i18n/config';
import { cn } from '@acta-products/ui';

const localeOptions: { value: Locale; code: string; labelKey: 'localeEn' | 'localeEs' }[] = [
  { value: 'en', code: 'EN', labelKey: 'localeEn' },
  { value: 'es', code: 'ES', labelKey: 'localeEs' },
];

interface LocaleSwitcherProps {
  className?: string;
  /** Show a visible language label above the control (mobile menu). */
  showLabel?: boolean;
}

export function LocaleSwitcher({ className, showLabel = false }: LocaleSwitcherProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations('nav');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeIndex = Math.max(
    0,
    localeOptions.findIndex((option) => option.value === locale),
  );

  function handleSelect(nextLocale: Locale) {
    if (nextLocale === locale || isPending) {
      return;
    }

    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  const control = (
    <div
      role="group"
      aria-label={t('language')}
      className={cn(
        'relative inline-grid h-7 shrink-0 grid-cols-2 rounded-[min(var(--radius-md),12px)] border border-border bg-muted/50 p-0.5 shadow-xs',
        'ring-1 ring-border/40 dark:border-input dark:bg-input/40',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-[min(var(--radius-md),10px)]',
          'bg-background shadow-sm ring-1 ring-border/60 transition-[left] duration-200 ease-out',
          'dark:bg-background/90 dark:ring-border/40',
          activeIndex === 0 ? 'left-0.5' : 'left-[calc(50%+1px)]',
        )}
      />

      {localeOptions.map(({ value, code, labelKey }) => {
        const isActive = locale === value;

        return (
          <button
            key={value}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            disabled={isPending}
            onClick={() => handleSelect(value)}
            className={cn(
              'relative z-10 flex min-w-[2.5rem] items-center justify-center px-2.5',
              'font-mono text-[0.6875rem] font-semibold tracking-[0.08em] transition-colors duration-200',
              'rounded-[min(var(--radius-md),10px)] outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {code}
            <span className="sr-only">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );

  if (showLabel) {
    return (
      <div className={cn('flex flex-col gap-2.5 px-3 py-1', className)}>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Globe className="size-3.5 shrink-0 text-primary/70" aria-hidden />
          {t('language')}
        </div>
        {control}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-transparent pr-0.5',
        className,
      )}
    >
      <Globe
        className="size-3.5 shrink-0 text-muted-foreground/80"
        aria-hidden
        strokeWidth={1.75}
      />
      {control}
    </div>
  );
}
