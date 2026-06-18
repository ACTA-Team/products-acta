/**
 * Categories of verifiable credentials related to credit.
 */
export type CreditCategory =
  | 'INCOME'             // proof of income
  | 'EMPLOYMENT'         // employment verification
  | 'REPAYMENT_HISTORY'  // payment history
  | 'LOAN'               // loan (settled or active)
  | 'UTILITY';           // utility payments (electricity, water, etc.)

/**
 * App-level states for a credential.
 * Maps the 2 SDK states (valid/revoked) and the local error/not-found state (invalid).
 */
export type CreditStatus =
  | { kind: 'valid' }
  | { kind: 'revoked'; revokedAt: string } // ISO timestamp
  | { kind: 'invalid' };                   // not found / not verifiable (app state)

/**
 * The credit VC at the app level.
 */
export interface CreditCredential {
  id: string;
  category: CreditCategory;
  issuerName: string;
  issuerDid: string;     // format did:pkh:stellar:{network}:{G…}
  issuedAt: string;      // ISO timestamp
  status: CreditStatus;
  claims: Record<string, unknown>; // category-specific data (intentionally loose typing)
}

/**
 * Profile summary containing totals per category and credential status counts.
 */
export interface CreditProfileSummary {
  totalsByCategory: Record<CreditCategory, number>;
  counts: { valid: number; revoked: number; invalid: number };
  oldestIssuedAt: string | null; // ISO timestamp of the oldest credential; null if none
}
