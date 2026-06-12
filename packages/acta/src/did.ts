
export type StellarNetwork = 'testnet' | 'mainnet';

export const DID_PKH_STELLAR_PREFIX = 'did:pkh:stellar';

/** Builds the default ACTA DID for a Stellar account, matching acta-api. */
export function didPkhStellar(network: StellarNetwork, address: string): string {
  return `${DID_PKH_STELLAR_PREFIX}:${network}:${address}`;
}
