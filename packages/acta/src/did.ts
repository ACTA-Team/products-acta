/**
 * ACTA's default identity method is did:pkh on the Stellar namespace,
 * derived from the classic account public key (G...). acta-api emits it as:
 *
 *   did:pkh:stellar:{network}:{G...}
 *
 * e.g. did:pkh:stellar:testnet:GABC...  (see acta-api,
 * src/services/contracts/acta-write.services.ts). Note the network segment:
 * the DID is NOT just did:pkh:stellar:{G...}.
 */
export type StellarNetwork = 'testnet' | 'mainnet';

export const DID_PKH_STELLAR_PREFIX = 'did:pkh:stellar';

/** Builds the default ACTA DID for a Stellar account, matching acta-api. */
export function didPkhStellar(network: StellarNetwork, address: string): string {
  return `${DID_PKH_STELLAR_PREFIX}:${network}:${address}`;
}
