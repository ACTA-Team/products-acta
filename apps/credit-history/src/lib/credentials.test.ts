import { describe, expect, it } from 'vitest';
import type { CreditCredential } from '@acta-products/acta/types';
import {
  categoryOf,
  detailClaimEntries,
  formatClaimValue,
  humanizeClaimKey,
  revokedAtOf,
  statusKindOf,
} from './credentials';

// Minimal credential factory — only the fields the helpers read.
function credential(overrides: Partial<CreditCredential> = {}): CreditCredential {
  return {
    id: 'cred-1',
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

describe('categoryOf', () => {
  it('maps known fixture types explicitly', () => {
    expect(categoryOf(credential({ type: 'IncomeVerification' }))).toBe('INCOME');
    expect(categoryOf(credential({ type: 'EmploymentVerification' }))).toBe('EMPLOYMENT');
    expect(categoryOf(credential({ type: 'MicrofinanceRepayment' }))).toBe('REPAYMENT_HISTORY');
    expect(categoryOf(credential({ type: 'DeFiLoan' }))).toBe('LOAN');
    expect(categoryOf(credential({ type: 'LegacyCreditLine' }))).toBe('LOAN');
    expect(categoryOf(credential({ type: 'UtilityPayment' }))).toBe('UTILITY');
  });

  it('falls back to keyword matching for unseen types', () => {
    expect(categoryOf(credential({ type: 'MonthlyPayrollProof' }))).toBe('INCOME');
    expect(categoryOf(credential({ type: 'SalarySlip' }))).toBe('INCOME');
    expect(categoryOf(credential({ type: 'SelfEmploymentAttestation' }))).toBe('EMPLOYMENT');
    expect(categoryOf(credential({ type: 'LoanRepaymentProof' }))).toBe('REPAYMENT_HISTORY');
    expect(categoryOf(credential({ type: 'WaterBillPayment' }))).toBe('UTILITY');
  });

  it('defaults unknown types to LOAN', () => {
    expect(categoryOf(credential({ type: 'SomethingCompletelyNew' }))).toBe('LOAN');
  });
});

describe('statusKindOf', () => {
  it('maps revoked to revoked and everything else to valid', () => {
    expect(statusKindOf(credential({ status: 'revoked' }))).toBe('revoked');
    expect(statusKindOf(credential({ status: 'valid' }))).toBe('valid');
  });
});

describe('revokedAtOf', () => {
  it('returns the revokedAt claim when present as a string', () => {
    const c = credential({ claims: { revokedAt: '2025-02-14T17:00:00Z' } });
    expect(revokedAtOf(c)).toBe('2025-02-14T17:00:00Z');
  });

  it('returns undefined when revokedAt is absent or not a string', () => {
    expect(revokedAtOf(credential({ claims: {} }))).toBeUndefined();
    expect(revokedAtOf(credential({ claims: { revokedAt: 123 } }))).toBeUndefined();
  });
});

describe('humanizeClaimKey', () => {
  it('splits camelCase and capitalizes', () => {
    expect(humanizeClaimKey('annualSalaryUSD')).toBe('Annual Salary USD');
    expect(humanizeClaimKey('employerName')).toBe('Employer Name');
  });

  it('replaces underscores from snake_case', () => {
    expect(humanizeClaimKey('account_status')).toBe('Account status');
  });
});

describe('formatClaimValue', () => {
  const labels = { yesLabel: 'Yes', noLabel: 'No' };

  it('formats booleans with the provided labels', () => {
    expect(formatClaimValue(true, labels)).toBe('Yes');
    expect(formatClaimValue(false, labels)).toBe('No');
  });

  it('formats numbers and strings', () => {
    expect(formatClaimValue(42, labels)).toBe('42');
    expect(formatClaimValue('hello', labels)).toBe('hello');
  });

  it('uses the empty label for null and undefined', () => {
    expect(formatClaimValue(null, labels)).toBe('—');
    expect(formatClaimValue(undefined, labels)).toBe('—');
    expect(formatClaimValue(null, { ...labels, emptyLabel: 'N/A' })).toBe('N/A');
  });

  it('stringifies objects and arrays as JSON', () => {
    expect(formatClaimValue({ a: 1 }, labels)).toBe('{"a":1}');
    expect(formatClaimValue([1, 2], labels)).toBe('[1,2]');
  });
});

describe('detailClaimEntries', () => {
  it('excludes keys shown elsewhere in the UI (revokedAt)', () => {
    const entries = detailClaimEntries({
      accountStatus: 'charged-off',
      revokedAt: '2025-02-14T17:00:00Z',
    });
    expect(entries).toEqual([['accountStatus', 'charged-off']]);
  });
});
