/**
 * Shared types used across ACTA products. Keep this package free of runtime
 * code and external dependencies.
 */

/** Metadata describing a product hosted in this monorepo. */
export interface ProductMeta {
  /** Folder name under apps/ (e.g. "credit-history"). */
  slug: string;
  name: string;
  description: string;
}

/** Represents a credit-related verifiable credential. */
export interface CreditCredential {
  id: string;
  type: string;
  title: string;
  issuer: string;
  issuerDid: string;
  issueDate: string;
  value: string | number;
  description: string;
  status: 'valid' | 'revoked';
  claims: Record<string, any>;
}

/** Summarized statistics for a credit profile. */
export interface CreditProfileSummary {
  holderDid: string;
  holderName: string;
  averageScore?: number;
  activeCredentialsCount: number;
  totalLoansRepaid?: number;
  riskCategory?: 'Low' | 'Medium' | 'High';
}

/** Mock-SDK read-only interface for fetching credentials. */
export interface CreditCredentialSource {
  listCredentials(): Promise<CreditCredential[]>;
  getCredential(id: string): Promise<CreditCredential | null>;
  getProfileSummary(): Promise<CreditProfileSummary>;
}

