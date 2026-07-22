import { didStellar } from './did';
import { ActaCredentialSource } from './acta-credential-source';
import type {
  CreditCredential,
  CreditProfileSummary,
  CreditCredentialSource,
} from '@acta-products/types';

// Re-export the interface so consumers can import it from this package too
export type { CreditCredential, CreditProfileSummary, CreditCredentialSource };

const TESTNET = 'testnet';
const MAINNET = 'mainnet';

export const FIXTURES: CreditCredential[] = [
  // ── INCOME ──────────────────────────────────────────────────────────────
  {
    id: 'cred-income-anchor-payroll',
    type: 'IncomeVerification',
    title: 'Anchor Payroll Income',
    issuer: 'Stellar Anchor Payroll Services',
    issuerDid: didStellar(MAINNET, 'GAPAYROLL5ANCHORSVC1234567890ABCDEF1234567890ABCDEF12345'),
    issueDate: '2026-03-01T14:15:00Z',
    value: '$45,000 USD / yr',
    description: 'Verified recurring salary deposits routed through a registered Stellar Anchor.',
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
    type: 'EmploymentVerification',
    title: 'Full-Time Employment Verification',
    issuer: 'WorkVerify DAO',
    issuerDid: didStellar(MAINNET, 'GWORKVERIFYDAO9876543210ABCDEF9876543210ABCDEF9876543210'),
    issueDate: '2025-11-10T09:00:00Z',
    value: 'Full-Time',
    description:
      'Verified full-time employment status issued by a decentralised employer registry.',
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
    type: 'MicrofinanceRepayment',
    title: 'Microfinance Repayment Record',
    issuer: 'Community Microfinance Network',
    issuerDid: didStellar(TESTNET, 'GCMFNEWORK1234567890ABCDEF1234567890ABCDEF1234567890ABCD'),
    issueDate: '2025-08-20T10:30:00Z',
    value: '100% On-time',
    description: 'Historical repayment record for community micro-loans settled on-chain.',
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
    type: 'DeFiLoan',
    title: 'Soroban DeFi Loan',
    issuer: 'Soroban Lending Pool v2',
    issuerDid: didStellar(MAINNET, 'GSOROBANLEND2222222222ABCDEF2222222222ABCDEF2222222222AB'),
    issueDate: '2024-12-05T08:00:00Z',
    value: '$5,000 USD',
    description: 'Active DeFi loan issued via a Soroban smart contract lending pool.',
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
    type: 'UtilityPayment',
    title: 'Electric Bill Payment History',
    issuer: 'GreenGrid Utility Verifier',
    issuerDid: didStellar(MAINNET, 'GGREENGRIDUTILITY3333333333ABCDEF3333333333ABCDEF333333'),
    issueDate: '2026-01-15T08:00:00Z',
    value: '18 months on-time',
    description: 'Consecutive on-time utility payments verified by a registered billing authority.',
    status: 'valid',
    claims: {
      utilityType: 'electricity',
      provider: 'National Electric S.A.',
      accountId: 'NE-7891234',
      consecutiveOnTimePayments: 18,
      averageMonthlyUSD: 42,
    },
  },

  // ── REVOKED ─────────────────────────────────────────────────────────────
  {
    id: 'cred-loan-legacy-revoked',
    type: 'LegacyCreditLine',
    title: 'Traditional Credit Line (Revoked)',
    issuer: 'Traditional Financial Services',
    issuerDid: didStellar(MAINNET, 'GTRADFINSERVICES8888888888ABCDEF8888888888ABCDEF88888888'),
    issueDate: '2024-05-10T09:00:00Z',
    value: 'Delinquent',
    description:
      'Credit line credential revoked due to account charge-off after 180 days past due.',
    status: 'revoked',
    claims: {
      accountStatus: 'charged-off',
      outstandingBalanceUSD: 1420,
      daysPastDue: 180,
      creditLimit: 3000,
      revokedAt: '2025-02-14T17:00:00Z',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: derive CreditProfileSummary from the fixture list (not hardcoded)
// ─────────────────────────────────────────────────────────────────────────────

function deriveProfileSummary(credentials: CreditCredential[]): CreditProfileSummary {
  const active = credentials.filter((c) => c.status === 'valid');
  const repaidLoans = credentials.filter(
    (c) => c.type === 'MicrofinanceRepayment' || c.type === 'DeFiLoan'
  );

  const scores = active
    .map((c) => (typeof c.value === 'number' ? c.value : null))
    .filter((v): v is number => v !== null);
  const averageScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined;

  return {
    holderDid: didStellar(TESTNET, 'GHOLDERVAULT111222333444555ABCDEF111222333444555ABCDEF11'),
    holderName: 'Alex Mercer',
    averageScore,
    activeCredentialsCount: active.length,
    totalLoansRepaid: repaidLoans.length,
    riskCategory: active.length >= 4 ? 'Low' : active.length >= 2 ? 'Medium' : 'High',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock mode types
// ─────────────────────────────────────────────────────────────────────────────

export type MockMode = 'normal' | 'empty' | 'error';

export interface MockSourceOptions {
  mode?: MockMode;
  delayMs?: number;
  /** Stellar G... address of the connected holder — required for the real source. */
  owner?: string;
  /** Full did:stellar for the holder, forwarded to ActaCredentialSource when present. */
  holderDid?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MockCredentialSource  (Step 2)
// ─────────────────────────────────────────────────────────────────────────────

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
    if (this.mode === 'empty') return [];
    return [...FIXTURES];
  }

  async getCredential(id: string): Promise<CreditCredential | null> {
    await this.delay();
    if (this.mode === 'error') {
      throw new Error(`[MockCredentialSource] Simulated network error in getCredential(${id})`);
    }
    if (this.mode === 'empty') return null;
    return FIXTURES.find((c) => c.id === id) ?? null;
  }

  async getProfileSummary(): Promise<CreditProfileSummary> {
    await this.delay();
    if (this.mode === 'error') {
      throw new Error('[MockCredentialSource] Simulated network error in getProfileSummary()');
    }
    if (this.mode === 'empty') return deriveProfileSummary([]);
    return deriveProfileSummary(FIXTURES);
  }
}

// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time when bundled by the app.
declare const process: { env: Record<string, string | undefined> };

function resolveMockMode(): MockMode {
  const envMode = process.env.NEXT_PUBLIC_MOCK_MODE ?? '';
  if (envMode === 'empty' || envMode === 'error') return envMode;
  return 'normal';
}

export function getCredentialSource(options?: MockSourceOptions): CreditCredentialSource {
  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock';

  if (dataSource === 'real' && options?.owner) {
    return new ActaCredentialSource({ owner: options.owner, holderDid: options.holderDid });
  }

  if (dataSource !== 'mock' && dataSource !== 'real') {
    console.warn(
      `[getCredentialSource] Unrecognised NEXT_PUBLIC_DATA_SOURCE="${dataSource}". Falling back to mock.`
    );
  }
  // dataSource === 'real' but no owner (e.g. share/verify pages, or session
  // not yet connected) intentionally falls through to mock — see #36 PR notes.

  const mode = options?.mode ?? resolveMockMode();
  const delayMs = options?.delayMs ?? 120;

  return new MockCredentialSource({ mode, delayMs });
}