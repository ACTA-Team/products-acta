/**
 * @fileoverview DID helpers for the did:stellar method.
 *
 * The ACTA DID method is did:stellar:{network}:{G…address}.
 * All previous did:pkh:stellar references have been removed.
 */

export const DID_STELLAR_PREFIX = 'did:stellar';

/**
 * Construct a did:stellar DID.
 *
 * @param network - Stellar network identifier, e.g. 'testnet' or 'mainnet'.
 * @param address - The holder's Stellar public key (G…).
 * @returns A fully-qualified DID string, e.g. 'did:stellar:testnet:GABC…'.
 */
export function didStellar(network: string, address: string): string {
  return `${DID_STELLAR_PREFIX}:${network}:${address}`;
}