import { CreditCredential, CreditProfileSummary, CreditCredentialSource } from '@acta-products/types';

export const mockCreditCredentials: CreditCredential[] = [
  {
    id: 'cred-stellar-score',
    type: 'StellarCreditScore',
    title: 'Stellar Credit Score',
    issuer: 'ACTA Rating Agency',
    issuerDid: 'did:pkh:stellar:G-ACTARATINGAGENCY1234567890',
    issueDate: '2026-01-15T08:00:00Z',
    value: 740,
    description: 'Verifiable credit score generated using on-chain transaction history, volume, and age on the Stellar network.',
    status: 'valid',
    claims: {
      scoreType: 'Soroban Credit Score',
      scoreRange: '300-850',
      activeMonths: 24,
      onChainBalanceUSD: 1250,
      monthlyVolumeUSD: 3100,
    },
  },
  {
    id: 'cred-microfinance-repay',
    type: 'MicrofinanceRepayment',
    title: 'Microfinance Repayment History',
    issuer: 'Community Microfinance Network',
    issuerDid: 'did:pkh:stellar:G-COMMUNITYMICROFINANCE9876',
    issueDate: '2025-11-20T10:30:00Z',
    value: '100% On-time',
    description: 'Historical repayment rate for community micro-loans issued and settled on-chain via peer-to-peer pools.',
    status: 'valid',
    claims: {
      totalLoansSettled: 4,
      missedPayments: 0,
      totalRepaidAmountUSD: 2400,
      longestLoanTermMonths: 6,
    },
  },
  {
    id: 'cred-income-verify',
    type: 'IncomeVerification',
    title: 'Income & Employment Verification',
    issuer: 'Stellar Anchor Payroll Services',
    issuerDid: 'did:pkh:stellar:G-STELLARPAYROLLANCHOR5555',
    issueDate: '2026-03-01T14:15:00Z',
    value: '$45,000 USD / yr',
    description: 'Verified proof of recurring employment salary deposits routed through a registered Stellar Anchor.',
    status: 'valid',
    claims: {
      employerName: 'Digital Solutions Inc.',
      depositFrequency: 'Bi-weekly',
      averageMonthlySalaryUSD: 3750,
      verificationPeriodMonths: 12,
    },
  },
  {
    id: 'cred-identity-kyc',
    type: 'IdentityKYC',
    title: 'Identity Verification (KYC)',
    issuer: 'ACTA Compliance Authority',
    issuerDid: 'did:pkh:stellar:G-ACTACOMPLIANCEAUTH99999',
    issueDate: '2025-09-10T11:00:00Z',
    value: 'Passed',
    description: 'Verifiable validation of holder identity, including proof of address and government-issued ID checks.',
    status: 'valid',
    claims: {
      identityProvider: 'ACTA KYC API v2',
      verificationLevel: 'Level 2 (Full KYC)',
      documentType: 'Passport',
      jurisdiction: 'Global / US-compliant',
    },
  },
  {
    id: 'cred-legacy-revoked',
    type: 'LegacyCreditLine',
    title: 'Traditional Credit Line (Legacy)',
    issuer: 'Traditional Financial Services',
    issuerDid: 'did:pkh:stellar:G-TRADITIONALFINANCIAL8888',
    issueDate: '2024-05-10T09:00:00Z',
    value: 'Delinquent',
    description: 'Verification of a credit card account line. This credential has been revoked due to account termination.',
    status: 'revoked',
    claims: {
      accountStatus: 'Charged Off',
      outstandingBalanceUSD: 1420,
      daysPastDue: 180,
    },
  },
];

export const mockProfileSummary: CreditProfileSummary = {
  holderDid: 'did:pkh:stellar:G-HOLDERVAULT111222333444',
  holderName: 'Alex Mercer',
  averageScore: 740,
  activeCredentialsCount: 4,
  totalLoansRepaid: 4,
  riskCategory: 'Low',
};

class MockCreditCredentialSource implements CreditCredentialSource {
  async listCredentials(): Promise<CreditCredential[]> {
    // Simulate slight API delay for fidelity
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockCreditCredentials), 100);
    });
  }

  async getCredential(id: string): Promise<CreditCredential | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const cred = mockCreditCredentials.find((c) => c.id === id);
        resolve(cred || null);
      }, 50);
    });
  }

  async getProfileSummary(): Promise<CreditProfileSummary> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockProfileSummary), 100);
    });
  }
}

const mockSource = new MockCreditCredentialSource();

export function getMockCreditCredentialSource(): CreditCredentialSource {
  return mockSource;
}
