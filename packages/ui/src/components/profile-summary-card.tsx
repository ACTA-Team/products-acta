import * as React from 'react';
import { Info } from 'lucide-react';
import { CategoryIcon, type CreditCategoryKey } from './category-icon';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './card';
import { cn } from '../lib/utils';

export interface ProfileSummaryStat {
  /** Localised label, e.g. "Total credentials". */
  label: string;
  /** Pre-formatted value (number-as-string or a date), formatted by the caller. */
  value: string;
}

export interface ProfileSummaryCategoryItem {
  category: CreditCategoryKey;
  /** Localised category label, e.g. "Income". */
  label: string;
  count: number;
}

export interface ProfileSummaryTimeline {
  /** Label for the start node (oldest credential date), e.g. "Mar 2024". */
  startLabel: string;
  /** Label for the end node, e.g. "Today". */
  endLabel: string;
  /** Localised caption under the timeline. */
  caption: string;
}

export interface ProfileSummaryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Explicit disclaimer: informational only, not a credit score / risk assessment. */
  disclaimer: string;
  /** Counter stats (e.g. Total / Current / Revoked / History since). */
  stats: ProfileSummaryStat[];
  /** Heading for the per-category breakdown. */
  categoriesTitle: string;
  categories: ProfileSummaryCategoryItem[];
  /** Optional simple timeline; omit when there is no history yet. */
  timeline?: ProfileSummaryTimeline;
}

/**
 * Informational credit profile summary card (credential counts and categories).
 *
 * Text is passed in via props so this component stays i18n-agnostic and can
 * be reused across products without bundling any copy. Callers must supply an
 * explicit disclaimer that this is an overview only — not a credit score or
 * risk assessment.
 */
export function ProfileSummaryCard({
  title,
  disclaimer,
  stats,
  categoriesTitle,
  categories,
  timeline,
  className,
  ...props
}: ProfileSummaryCardProps) {
  return (
    <Card data-slot="profile-summary-card" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <span className="inline-flex items-start gap-1.5">
            <Info
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground sm:size-4"
              aria-hidden="true"
            />
            <span>{disclaimer}</span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="text-2xl font-semibold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{categoriesTitle}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((item) => (
              <div
                key={item.category}
                className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2"
              >
                <CategoryIcon category={item.category} className="size-4 text-muted-foreground" />
                <span className="text-sm">{item.label}</span>
                <span className="ml-auto font-semibold tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {timeline ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-medium">
              <span>{timeline.startLabel}</span>
              <span>{timeline.endLabel}</span>
            </div>
            <div className="relative">
              <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-primary/40 to-primary" />
              <div
                className="absolute left-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary"
                aria-hidden="true"
              />
              <div
                className="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-muted-foreground">{timeline.caption}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
