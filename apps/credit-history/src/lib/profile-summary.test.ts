import { describe, expect, it } from 'vitest';
import type { CreditCredential } from '@acta-products/acta/types';
import { computeProfileSummary } from './profile-summary';

function credential(overrides: Partial<CreditCredential>): CreditCredential {
  return {
    id: 'cred',
    type: 'IncomeVerification',
    title: 'Test',
    issuer: 'Issuer',
    issuerDid: 'did:stellar:testnet:GTEST',
    issueDate: '2025-01-01T00:00:00Z',
    value: 'x',
    description: 'Test credential',
    status: 'valid',
    claims: {},
    ...overrides,
  };
}

// A deterministic mix spanning every category and both statuses.
const SAMPLE: CreditCredential[] = [
  credential({ id: 'a', type: 'IncomeVerification', issueDate: '2026-03-01T00:00:00Z' }),
  credential({ id: 'b', type: 'EmploymentVerification', issueDate: '2025-11-10T00:00:00Z' }),
  credential({ id: 'c', type: 'MicrofinanceRepayment', issueDate: '2025-08-20T00:00:00Z' }),
  credential({ id: 'd', type: 'DeFiLoan', issueDate: '2024-12-05T00:00:00Z' }),
  credential({ id: 'e', type: 'UtilityPayment', issueDate: '2026-01-15T00:00:00Z' }),
  credential({
    id: 'f',
    type: 'LegacyCreditLine',
    status: 'revoked',
    issueDate: '2024-05-10T00:00:00Z',
  }),
];

describe('computeProfileSummary', () => {
  it('counts valid and revoked credentials', () => {
    const { counts } = computeProfileSummary(SAMPLE);
    expect(counts).toEqual({ valid: 5, revoked: 1, invalid: 0 });
  });

  it('totals credentials by category (LegacyCreditLine and DeFiLoan both count as LOAN)', () => {
    const { totalsByCategory } = computeProfileSummary(SAMPLE);
    expect(totalsByCategory).toEqual({
      INCOME: 1,
      EMPLOYMENT: 1,
      REPAYMENT_HISTORY: 1,
      LOAN: 2,
      UTILITY: 1,
    });
  });

  it('reports the oldest issue date (lexicographic === chronological for ISO)', () => {
    expect(computeProfileSummary(SAMPLE).oldestIssuedAt).toBe('2024-05-10T00:00:00Z');
  });

  it('returns zeroed totals, zero counts, and null oldest for an empty list', () => {
    const summary = computeProfileSummary([]);
    expect(summary.counts).toEqual({ valid: 0, revoked: 0, invalid: 0 });
    expect(summary.totalsByCategory).toEqual({
      INCOME: 0,
      EMPLOYMENT: 0,
      REPAYMENT_HISTORY: 0,
      LOAN: 0,
      UTILITY: 0,
    });
    expect(summary.oldestIssuedAt).toBeNull();
  });
});
