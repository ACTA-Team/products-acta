import type { CreditCredential } from '@acta-products/acta/types';
import type { CredentialStatusKind } from '@acta-products/ui';
import type { CreditCategory } from '@/types';

/**
 * View helpers for the holder credential list.
 *
 * The mock data layer (#5) returns the wire-shape `CreditCredential` from
 * `@acta-products/types`, which carries an issuer-defined `type` string and a
 * coarse `status` of `'valid' | 'revoked'`. The UI groups credentials by the
 * #6 domain `CreditCategory` and renders a richer status, so we derive both
 * here instead of hardcoding them in JSX.
 */

/** Stable order used for category filter controls and summaries. */
export const CREDIT_CATEGORIES: readonly CreditCategory[] = [
  'INCOME',
  'EMPLOYMENT',
  'REPAYMENT_HISTORY',
  'LOAN',
  'UTILITY',
] as const;

/** Status filter values surfaced in the UI (mirrors `CredentialStatusKind`). */
export const CREDENTIAL_STATUSES: readonly CredentialStatusKind[] = [
  'valid',
  'revoked',
  'invalid',
] as const;

// Known fixture `type` values → domain category.
const TYPE_TO_CATEGORY: Record<string, CreditCategory> = {
  IncomeVerification: 'INCOME',
  EmploymentVerification: 'EMPLOYMENT',
  MicrofinanceRepayment: 'REPAYMENT_HISTORY',
  DeFiLoan: 'LOAN',
  LegacyCreditLine: 'LOAN',
  UtilityPayment: 'UTILITY',
};

/**
 * Derive the domain `CreditCategory` for a credential from its issuer `type`.
 * Falls back to keyword matching so unseen types still land in a sane bucket.
 */
export function categoryOf(credential: CreditCredential): CreditCategory {
  const explicit = TYPE_TO_CATEGORY[credential.type];
  if (explicit) return explicit;

  const t = credential.type.toLowerCase();
  if (t.includes('income') || t.includes('payroll') || t.includes('salary')) return 'INCOME';
  if (t.includes('employ')) return 'EMPLOYMENT';
  if (t.includes('repayment') || t.includes('microfinance')) return 'REPAYMENT_HISTORY';
  if (t.includes('utility') || t.includes('bill')) return 'UTILITY';
  return 'LOAN';
}

/**
 * Map the wire status to the app-level `CredentialStatusKind`. The list reads
 * from the mock source, which only ever yields `valid | revoked`; the
 * `invalid` kind exists for callers (detail/verify) that hit not-found /
 * non-verifiable states.
 */
export function statusKindOf(credential: CreditCredential): CredentialStatusKind {
  return credential.status === 'revoked' ? 'revoked' : 'valid';
}

/**
 * Resolve the ISO revocation timestamp for a revoked credential, read from
 * `claims.revokedAt`. Returns `undefined` when absent (caller decides how to
 * render a revoked badge without a date).
 */
export function revokedAtOf(credential: CreditCredential): string | undefined {
  const revokedAt = credential.claims?.revokedAt;
  return typeof revokedAt === 'string' ? revokedAt : undefined;
}

/** Keys omitted from the claims list because they are shown elsewhere in the UI. */
export const DETAIL_CLAIMS_OMIT = new Set(['revokedAt']);

/**
 * Turn a camelCase / snake_case claim key into a readable label without
 * hardcoding per-category copy (claims are issuer-defined).
 */
export function humanizeClaimKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface FormatClaimValueOptions {
  yesLabel: string;
  noLabel: string;
  emptyLabel?: string;
}

/**
 * Format a claim value for display. Primitives render as strings; booleans
 * use caller-provided yes/no labels (i18n). Objects/arrays stringify as JSON.
 */
export function formatClaimValue(
  value: unknown,
  { yesLabel, noLabel, emptyLabel = '—' }: FormatClaimValueOptions
): string {
  if (value === null || value === undefined) return emptyLabel;
  if (typeof value === 'boolean') return value ? yesLabel : noLabel;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return emptyLabel;
  }
}

/** Claim entries for the detail view, excluding keys shown elsewhere. */
export function detailClaimEntries(claims: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(claims).filter(([key]) => !DETAIL_CLAIMS_OMIT.has(key));
}
