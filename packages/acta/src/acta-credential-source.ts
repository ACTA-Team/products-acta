import { useActaClient } from '@acta-team/credentials';
import type { CreditCredential, CreditCredentialSource, CreditProfileSummary } from '@acta-products/types';
import type { StellarNetwork } from './did';

/**
 * NOTE ON THE VC → CreditCredential MAPPING BELOW:
 * `vaultGetVcDirect` returns `vc: unknown` — the SDK does not type the raw
 * credential payload. This mapper assumes a W3C Verifiable Credential shape
 * (`credentialSubject`, `type[]`, `issuer`) since `vcIssue` requires `@context`.
 * This has NOT been verified against a real issued credential — only against
 * the SDK's type declarations. Before relying on this in production, issue one
 * real test credential and confirm the shape matches; adjust field lookups
 * below accordingly.
 */
function mapRawVcToCreditCredential(
  raw: unknown,
  vcId: string,
  verify: { status: 'valid' | 'revoked' } | null,
): CreditCredential | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const vc = raw as Record<string, unknown>;

  const subject: Record<string, unknown> =
    typeof vc.credentialSubject === 'object' && vc.credentialSubject !== null
      ? (vc.credentialSubject as Record<string, unknown>)
      : {};

  const typeArr = Array.isArray(vc.type)
    ? (vc.type as string[])
    : typeof vc.type === 'string'
      ? [vc.type]
      : [];
  // W3C VCs always include the literal "VerifiableCredential" type alongside
  // the specific one (e.g. ["VerifiableCredential", "IncomeVerification"]).
  const category = typeArr.find((t) => t !== 'VerifiableCredential') ?? typeArr[0] ?? 'Credential';

  const issuerField = vc.issuer;
  const issuerDid =
    typeof issuerField === 'string'
      ? issuerField
      : typeof (issuerField as { id?: unknown } | undefined)?.id === 'string'
        ? (issuerField as { id: string }).id
        : '';

  const issueDate =
    typeof vc.validFrom === 'string'
      ? vc.validFrom
      : typeof vc.issuanceDate === 'string'
        ? vc.issuanceDate
        : new Date(0).toISOString();

  const value =
    typeof subject.value === 'string' || typeof subject.value === 'number' ? subject.value : '';

  return {
    id: typeof vc.id === 'string' ? vc.id : vcId,
    type: category,
    title: typeof subject.title === 'string' ? subject.title : category,
    issuer: typeof subject.issuerName === 'string' ? subject.issuerName : issuerDid,
    issuerDid,
    issueDate,
    value,
    description: typeof subject.description === 'string' ? subject.description : '',
    status: verify?.status ?? 'valid',
    claims: subject,
  };
}

export interface ActaCredentialSourceOptions {
  /** Stellar G... address of the connected holder whose vault to read. */
  owner: string;
  /**
   * Full did:stellar for the holder, when the caller already has it
   * (e.g. from useSession()). Optional — falls back to '' when omitted,
   * since ActaCredentialSource has no network context of its own to derive
   * one from owner alone.
   */
  holderDid?: string;
}

export class ActaCredentialSource implements CreditCredentialSource {
  private readonly owner: string;
  private readonly holderDid: string;
  private readonly client: ReturnType<typeof useActaClient>;

  constructor({ owner, holderDid = '' }: ActaCredentialSourceOptions) {
    this.owner = owner;
    this.holderDid = holderDid;
    this.client = useActaClient();
  }

  async listCredentials(): Promise<CreditCredential[]> {
    const idsResponse = await this.client.vaultListVcIdsDirect({ owner: this.owner });
    const ids = idsResponse.vc_ids ?? idsResponse.result ?? [];
    const credentials = await Promise.all(ids.map((id) => this.fetchCredential(id)));
    return credentials.filter((c): c is CreditCredential => c !== null);
  }

  async getCredential(id: string): Promise<CreditCredential | null> {
    return this.fetchCredential(id);
  }

  async getProfileSummary(): Promise<CreditProfileSummary> {
    const credentials = await this.listCredentials();
    const active = credentials.filter((c) => c.status === 'valid');
    const repaidLoans = credentials.filter(
      (c) => c.type === 'MicrofinanceRepayment' || c.type === 'DeFiLoan',
    );
    const scores = active
      .map((c) => (typeof c.value === 'number' ? c.value : null))
      .filter((v): v is number => v !== null);
    const averageScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined;

    return {
      holderDid: this.holderDid,
      // FLAG: no name field exists anywhere in vault/DID data. Placeholder
      // until there's a real identity/profile layer.
      holderName: `${this.owner.slice(0, 6)}…${this.owner.slice(-4)}`,
      averageScore,
      activeCredentialsCount: active.length,
      totalLoansRepaid: repaidLoans.length,
      riskCategory: active.length >= 4 ? 'Low' : active.length >= 2 ? 'Medium' : 'High',
    };
  }

  private async fetchCredential(vcId: string): Promise<CreditCredential | null> {
    const [vcResponse, verifyResponse] = await Promise.all([
      this.client.vaultGetVcDirect({ owner: this.owner, vcId }),
      this.client.vaultVerify({ owner: this.owner, vcId }).catch(() => null),
    ]);
    const raw = vcResponse.vc ?? vcResponse.result;
    if (!raw) return null;
    return mapRawVcToCreditCredential(raw, vcId, verifyResponse);
  }
}