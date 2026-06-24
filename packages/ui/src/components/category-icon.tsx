import * as React from 'react';
import {
  Banknote,
  Briefcase,
  History,
  Landmark,
  Lightbulb,
  FileBadge,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Credit credential categories. Kept as a plain string union here (rather than
 * importing an app-level type) so the UI package stays free of product deps.
 * Callers pass the same category keys used across the credit-history product.
 */
export type CreditCategoryKey = 'INCOME' | 'EMPLOYMENT' | 'REPAYMENT_HISTORY' | 'LOAN' | 'UTILITY';

const CATEGORY_ICONS: Record<CreditCategoryKey, LucideIcon> = {
  INCOME: Banknote,
  EMPLOYMENT: Briefcase,
  REPAYMENT_HISTORY: History,
  LOAN: Landmark,
  UTILITY: Lightbulb,
};

export interface CategoryIconProps extends Omit<React.ComponentProps<LucideIcon>, 'ref'> {
  category: CreditCategoryKey;
}

/**
 * Renders the lucide icon for a credit category. Purely presentational and
 * decorative — mark it `aria-hidden` (default) and keep the textual category
 * label next to it for screen readers.
 */
export function CategoryIcon({ category, className, ...props }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category] ?? FileBadge;
  return <Icon aria-hidden="true" className={cn('size-5', className)} {...props} />;
}
