import { describe, expect, it } from 'vitest';
import { didStellar, parseDidStellar } from './did';

const ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('parseDidStellar', () => {
  it('parses a testnet did:stellar into network and address', () => {
    expect(parseDidStellar(didStellar('testnet', ADDRESS))).toEqual({
      network: 'testnet',
      address: ADDRESS,
    });
  });

  it('parses a mainnet did:stellar into network and address', () => {
    expect(parseDidStellar(didStellar('mainnet', ADDRESS))).toEqual({
      network: 'mainnet',
      address: ADDRESS,
    });
  });

  it('round-trips with didStellar', () => {
    const parsed = parseDidStellar(didStellar('testnet', ADDRESS));
    expect(parsed && didStellar(parsed.network, parsed.address)).toBe(
      didStellar('testnet', ADDRESS)
    );
  });

  it('returns null for a non-stellar DID method', () => {
    expect(parseDidStellar(`did:pkh:stellar:${ADDRESS}`)).toBeNull();
  });

  it('returns null for an unknown network', () => {
    expect(parseDidStellar(`did:stellar:futurenet:${ADDRESS}`)).toBeNull();
  });

  it('returns null when the address segment is missing', () => {
    expect(parseDidStellar('did:stellar:testnet:')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseDidStellar('')).toBeNull();
    expect(parseDidStellar('not-a-did')).toBeNull();
    expect(parseDidStellar(ADDRESS)).toBeNull();
  });
});
