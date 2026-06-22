import { didPkhStellar, StellarNetwork } from './did';

// ─────────────────────────────────────────────────────────────────────────────
// Domain types (re-exported from @acta-products/types — #6)
// ─────────────────────────────────────────────────────────────────────────────

export type CreditStatus = 'valid' | 'revoked' | 'invalid';

export type CreditCategory =
  | 'INCOME'
  | 'EMPLOYMENT'
  | 'REPAYMENT_HISTORY'
  | 'LOAN'
  | 'UTILITY';

export interface CreditCredential {
  id: string;
  category: CreditCategory;
  title: string;
  issuer: string;
  issuerDid: string;
  issuedAt: string;          // ISO 8601
  revokedAt?: string;        // ISO 8601 — present only when status === 'revoked'
  status: CreditStatus;
  claims: Record<string, unknown>;
}

export interface CreditProfileSummary {
  totalCredentials: number;
  byCategory: Record<CreditCategory, number>;
  byStatus: Record<CreditStatus, number>;
  /** ISO 8601 date of the oldest credential */
  oldestCredentialAt: string;
}

export interface CreditCredentialSource {
  listCredentials(): Promise<CreditCredential[]>;
  getCredential(id: string): Promise<CreditCredential | null>;
  getProfileSummary(): Promise<CreditProfileSummary>;
}

const TESTNET: StellarNetwork = 'testnet';
const MAINNET: StellarNetwork = 'mainnet';

export const FIXTURES: CreditCredential[] = [
  // ── INCOME ──────────────────────────────────────────────────────────────
  {
    id: 'cred-income-anchor-payroll',
    category: 'INCOME',
    title: 'Anchor Payroll Income',
    issuer: 'Stellar Anchor Payroll Services',
    issuerDid: didPkhStellar(MAINNET, 'GAPAYROLL5ANCHORSVC1234567890ABCDEF1234567890ABCDEF12345'),
    issuedAt: '2026-03-01T14:15:00Z',
    status: 'valid',
    claims: {
      employerName: 'Digital Solutions Inc.',
      annualSalaryUSD: 45000,
      depositFrequency: 'bi-weekly',
      averageMonthlySalaryUSD: 3750,
      verificationPeriodMonths: 12,
      anchorAsset: 'USDC',
    },
  },

  // ── EMPLOYMENT ──────────────────────────────────────────────────────────
  {
    id: 'cred-employment-verified',
    category: 'EMPLOYMENT',
    title: 'Full-Time Employment Verification',
    issuer: 'WorkVerify DAO',
    issuerDid: didPkhStellar(MAINNET, 'GWORKVERIFYDAO9876543210ABCDEF9876543210ABCDEF9876543210'),
    issuedAt: '2025-11-10T09:00:00Z',
    status: 'valid',
    claims: {
      employerName: 'Digital Solutions Inc.',
      jobTitle: 'Senior Backend Engineer',
      startDate: '2023-06-01',
      employmentType: 'full-time',
      contractDurationMonths: null,
    },
  },

  // ── REPAYMENT_HISTORY ───────────────────────────────────────────────────
  {
    id: 'cred-repayment-microfinance',
    category: 'REPAYMENT_HISTORY',
    title: 'Microfinance Repayment Record',
    issuer: 'Community Microfinance Network',
    issuerDid: didPkhStellar(TESTNET, 'GCMFNEWORK1234567890ABCDEF1234567890ABCDEF1234567890ABCD'),
    issuedAt: '2025-08-20T10:30:00Z',
    status: 'valid',
    claims: {
      totalLoansSettled: 4,
      missedPayments: 0,
      onTimePaymentRate: '100%',
      totalRepaidAmountUSD: 2400,
      longestLoanTermMonths: 6,
    },
  },

  // ── LOAN ────────────────────────────────────────────────────────────────
  {
    id: 'cred-loan-soroban-pool',
    category: 'LOAN',
    title: 'Soroban DeFi Loan',
    issuer: 'Soroban Lending Pool v2',
    issuerDid: didPkhStellar(MAINNET, 'GSOROBANLEND2222222222ABCDEF2222222222ABCDEF2222222222AB'),
    issuedAt: '2024-12-05T08:00:00Z',
    status: 'valid',
    claims: {
      principalUSD: 5000,
      termMonths: 12,
      interestRateAPR: '8.5%',
      collateralAsset: 'XLM',
      collateralRatio: 1.5,
      currentLtv: '62%',
    },
  },

  // ── UTILITY ─────────────────────────────────────────────────────────────
  {
    id: 'cred-utility-electric',
    category: 'UTILITY',
    title: 'Electric Bill Payment History',
    issuer: 'GreenGrid Utility Verifier',
    issuerDid: didPkhStellar(MAINNET, 'GGREENGRIDUTILITY3333333333ABCDEF3333333333ABCDEF333333'),
    issuedAt: '2026-01-15T08:00:00Z',
    status: 'valid',
    claims: {
      utilityType: 'electricity',
      provider: 'National Electric S.A.',
      accountId: 'NE-7891234',
      consecutiveOnTimePayments: 18,
      averageMonthlyUSD: 42,
    },
  },

  // ── REVOKED (with revokedAt) ─────────────────────────────────────────────
  {
    id: 'cred-loan-legacy-revoked',
    category: 'LOAN',
    title: 'Traditional Credit Line (Revoked)',
    issuer: 'Traditional Financial Services',
    issuerDid: didPkhStellar(MAINNET, 'GTRADFINSERVICES8888888888ABCDEF8888888888ABCDEF88888888'),
    issuedAt: '2024-05-10T09:00:00Z',
    revokedAt: '2025-02-14T17:00:00Z',
    status: 'revoked',
    claims: {
      accountStatus: 'charged-off',
      outstandingBalanceUSD: 1420,
      daysPastDue: 180,
      creditLimit: 3000,
    },
  },

  // ── INVALID ──────────────────────────────────────────────────────────────
  // Represents a VC that was found in the vault but could not be verified
  // (getVc returned null, or verifyVc threw / returned an unexpected value).
  // The 'invalid' state is produced by THIS layer, not the SDK contract.
  {
    id: 'cred-income-unverifiable',
    category: 'INCOME',
    title: 'Income Claim (Unverifiable)',
    issuer: 'Unknown Issuer',
    issuerDid: didPkhStellar(TESTNET, 'GUNKNOWNISSUER0000000000ABCDEF0000000000ABCDEF0000000000'),
    issuedAt: '2023-07-01T00:00:00Z',
    status: 'invalid',
    claims: {
      reason: 'VC mapping failed — raw credential did not conform to CreditCredential schema',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: derive CreditProfileSummary from a fixture list  (not hardcoded)
// ─────────────────────────────────────────────────────────────────────────────

function deriveProfileSummary(credentials: CreditCredential[]): CreditProfileSummary {
  const allCategories: CreditCategory[] = [
    'INCOME',
    'EMPLOYMENT',
    'REPAYMENT_HISTORY',
    'LOAN',
    'UTILITY',
  ];
  const allStatuses: CreditStatus[] = ['valid', 'revoked', 'invalid'];

  const byCategory = Object.fromEntries(
    allCategories.map((cat) => [
      cat,
      credentials.filter((c) => c.category === cat).length,
    ]),
  ) as Record<CreditCategory, number>;

  const byStatus = Object.fromEntries(
    allStatuses.map((s) => [
      s,
      credentials.filter((c) => c.status === s).length,
    ]),
  ) as Record<CreditStatus, number>;

  // Age = oldest issuedAt date across the full list
  const oldestCredentialAt = credentials.reduce((oldest, c) => {
    return c.issuedAt < oldest ? c.issuedAt : oldest;
  }, credentials[0]?.issuedAt ?? new Date().toISOString());

  return {
    totalCredentials: credentials.length,
    byCategory,
    byStatus,
    oldestCredentialAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MockCredentialSource  (Step 2)
// ─────────────────────────────────────────────────────────────────────────────

export type MockMode = 'normal' | 'empty' | 'error';

export interface MockSourceOptions {
  /**
   * 'normal' → returns full fixture set  (default)
   * 'empty'  → listCredentials returns [],  getProfileSummary returns zero-counts
   * 'error'  → every method rejects with a controlled Error
   */
  mode?: MockMode;
  /**
   * Simulated network latency in ms.  Default: 120.
   * Set to 0 in unit tests to keep them fast.
   */
  delayMs?: number;
}

class MockCredentialSource implements CreditCredentialSource {
  private readonly mode: MockMode;
  private readonly delayMs: number;

  constructor({ mode = 'normal', delayMs = 120 }: MockSourceOptions = {}) {
    this.mode = mode;
    this.delayMs = delayMs;
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  async listCredentials(): Promise<CreditCredential[]> {
    await this.delay();

    if (this.mode === 'error') {
      throw new Error('[MockCredentialSource] Simulated network error in listCredentials()');
    }
    if (this.mode === 'empty') {
      return [];
    }

    return [...FIXTURES];
  }

  async getCredential(id: string): Promise<CreditCredential | null> {
    await this.delay();

    if (this.mode === 'error') {
      throw new Error(`[MockCredentialSource] Simulated network error in getCredential(${id})`);
    }
    if (this.mode === 'empty') {
      return null;
    }

    return FIXTURES.find((c) => c.id === id) ?? null;
  }

  async getProfileSummary(): Promise<CreditProfileSummary> {
    await this.delay();

    if (this.mode === 'error') {
      throw new Error('[MockCredentialSource] Simulated network error in getProfileSummary()');
    }
    if (this.mode === 'empty') {
      return deriveProfileSummary([]);
    }

    return deriveProfileSummary(FIXTURES);
  }
}

function resolveMockMode(): MockMode {
  // Next.js inlines NEXT_PUBLIC_* at build time; no Node process type needed.
  const envMode = (typeof NEXT_PUBLIC_MOCK_MODE !== 'undefined'
    ? NEXT_PUBLIC_MOCK_MODE
    : '') as string;
  if (envMode === 'empty' || envMode === 'error') return envMode as MockMode;
  return 'normal';
}

// Inlined by Next.js build — declared here so TypeScript resolves the name.
declare const NEXT_PUBLIC_MOCK_MODE: string | undefined;
declare const NEXT_PUBLIC_DATA_SOURCE: string | undefined;

export function getCredentialSource(options?: MockSourceOptions): CreditCredentialSource {
  const dataSource = (typeof NEXT_PUBLIC_DATA_SOURCE !== 'undefined'
    ? NEXT_PUBLIC_DATA_SOURCE
    : 'mock') as string;

  if (dataSource !== 'mock') {
    // SEAM: replace this block with ActaCredentialSource when ready.
    // For now, unrecognised values fall back to mock with a console warning.
    console.warn(
      `[getCredentialSource] Unrecognised NEXT_PUBLIC_DATA_SOURCE="${dataSource}". ` +
        'Falling back to mock. Set to "real" when ActaCredentialSource is available.',
    );
  }

  const mode = options?.mode ?? resolveMockMode();
  const delayMs = options?.delayMs ?? 120;

  return new MockCredentialSource({ mode, delayMs });
}