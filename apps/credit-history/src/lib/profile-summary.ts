import type { CreditCredential } from '@acta-products/acta/types';
import type { CreditProfileSummary, CreditCategory } from '@/types';
import { CREDIT_CATEGORIES, categoryOf, statusKindOf } from './credentials';

/**
 * Aggregate a list of credentials into a presentational profile summary:
 * totals per category, valid/revoked/invalid counts, and the date of the
 * oldest credential (history age). This is an informational overview only —
 * deliberately NOT a credit score or risk assessment.
 */
export function computeProfileSummary(credentials: CreditCredential[]): CreditProfileSummary {
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
