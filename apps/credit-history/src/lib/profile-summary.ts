import type { CreditCategory, CreditCredential } from '@acta-products/acta/types';
import { CREDIT_CATEGORIES, categoryOf, statusKindOf } from './credentials';

/**
 * Presentational breakdown of a credential list: totals per category,
 * valid/revoked/invalid counts, and the date of the oldest credential
 * (history age). Distinct from the SDK's holder-level `CreditProfileSummary`
 * (score/risk) — this is view-local and computed client-side.
 */
export interface CreditCategoryBreakdown {
  totalsByCategory: Record<CreditCategory, number>;
  counts: { valid: number; revoked: number; invalid: number };
  oldestIssuedAt: string | null;
}

/**
 * Aggregate a list of credentials into a presentational category breakdown.
 * This is an informational overview only — deliberately NOT a credit score
 * or risk assessment.
 */
export function computeProfileSummary(credentials: CreditCredential[]): CreditCategoryBreakdown {
  const totalsByCategory = Object.fromEntries(
    CREDIT_CATEGORIES.map((category) => [category, 0])
  ) as Record<CreditCategory, number>;

  const counts = { valid: 0, revoked: 0, invalid: 0 };
  let oldestIssuedAt: string | null = null;

  for (const credential of credentials) {
    totalsByCategory[categoryOf(credential)] += 1;
    counts[statusKindOf(credential)] += 1;
    // issueDate is an ISO timestamp; lexicographic compare === chronological.
    if (oldestIssuedAt === null || credential.issueDate < oldestIssuedAt) {
      oldestIssuedAt = credential.issueDate;
    }
  }

  return { totalsByCategory, counts, oldestIssuedAt };
}
