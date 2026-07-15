export type StellarNetwork = 'testnet' | 'mainnet';

export const DID_STELLAR_PREFIX = 'did:stellar';

/** Builds the default ACTA DID for a Stellar account, matching acta-api. */
export function didStellar(network: StellarNetwork, address: string): string {
  return `${DID_STELLAR_PREFIX}:${network}:${address}`;
}
