/**
 * @fileoverview DID helpers for the did:stellar method.
 *
 * The ACTA DID method is did:stellar:{network}:{G…address}.
 * All previous did:pkh:stellar references have been removed.
 */

/** Stellar networks ACTA currently supports for DID resolution. */
export type StellarNetwork = 'mainnet' | 'testnet';

export const DID_STELLAR_PREFIX = 'did:stellar';

/**
 * Construct a did:stellar DID.
 *
 * @param network - Stellar network identifier.
 * @param address - The holder's Stellar public key (G…).
 * @returns A fully-qualified DID string, e.g. 'did:stellar:testnet:GABC…'.
 */
export function didStellar(network: StellarNetwork, address: string): string {
  return `${DID_STELLAR_PREFIX}:${network}:${address}`;
}

/** The components of a parsed did:stellar identifier. */
export interface ParsedStellarDid {
  network: StellarNetwork;
  /** The holder's Stellar public key (G…). */
  address: string;
}

/**
 * Parse a did:stellar DID back into its network and address.
 *
 * The vault SDK addresses credentials by the owner's Stellar public key, so the
 * public verifier needs the G… address out of the presentation's holder DID.
 *
 * @param did - A candidate DID string.
 * @returns The parsed components, or `null` when `did` is not a well-formed
 *   `did:stellar:{network}:{address}` (e.g. a legacy or malformed identifier).
 */
export function parseDidStellar(did: string): ParsedStellarDid | null {
  const parts = did.split(':');
  if (parts.length !== 4) return null;
  const [scheme, method, network, address] = parts;
  if (scheme !== 'did' || method !== 'stellar') return null;
  if (network !== 'mainnet' && network !== 'testnet') return null;
  if (!address) return null;
  return { network, address };
}
