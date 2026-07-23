import { useActaClient, type ActaClient } from '@acta-team/credentials';
import type {
  CreditCredential,
  CreditCredentialSource,
  CreditProfileSummary,
} from '@acta-products/types';

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
  verify: { status: 'valid' | 'revoked'; since?: string } | null
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

  // When the vault reports a credential as revoked, `since` carries the on-chain
  // revocation timestamp. Surface it as `claims.revokedAt` so the UI (which reads
  // `revokedAtOf`) shows a real revocation date instead of the dateless badge.
  const claims: Record<string, unknown> =
    verify?.status === 'revoked' && typeof verify.since === 'string'
      ? { ...subject, revokedAt: verify.since }
      : subject;

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
    claims,
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
  /**
   * Pre-resolved ACTA SDK client. Pass this when the source is constructed
   * outside of React render (e.g. the public verifier builds it inside an
   * effect), since `useActaClient()` is a hook and may only run during render.
   * When omitted, the client is read from context via `useActaClient()`, which
   * requires the constructor to run during render inside an `ActaConfig`.
   */
  client?: ActaClient;
}

export class ActaCredentialSource implements CreditCredentialSource {
  private readonly owner: string;
  private readonly holderDid: string;
  private readonly client: ActaClient;

  constructor({ owner, holderDid = '', client }: ActaCredentialSourceOptions) {
    this.owner = owner;
    this.holderDid = holderDid;
    // Prefer the injected client; `??` short-circuits so the hook is only called
    // when no client was provided (render-time callers keep working unchanged).
    this.client = client ?? useActaClient();
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
      (c) => c.type === 'MicrofinanceRepayment' || c.type === 'DeFiLoan'
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
