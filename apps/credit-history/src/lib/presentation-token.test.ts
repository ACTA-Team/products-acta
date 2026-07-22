import { describe, expect, it } from 'vitest';
import {
  decodePresentationToken,
  encodePresentationToken,
  type PresentationPayload,
} from './presentation-token';

describe('presentation-token codec', () => {
  it('round-trips a payload with a numeric expiry', () => {
    const payload: PresentationPayload = { ids: ['cred-a', 'cred-b'], exp: 1_800_000_000_000 };
    expect(decodePresentationToken(encodePresentationToken(payload))).toEqual(payload);
  });

  it('round-trips a payload with a null expiry', () => {
    const payload: PresentationPayload = { ids: ['cred-a'], exp: null };
    expect(decodePresentationToken(encodePresentationToken(payload))).toEqual(payload);
  });

  it('round-trips ids containing unicode and url-unsafe bytes', () => {
    const payload: PresentationPayload = { ids: ['crédito-ñ-🎉', 'a+b/c=d'], exp: null };
    expect(decodePresentationToken(encodePresentationToken(payload))).toEqual(payload);
  });

  it('produces a url-safe token (no +, /, or = padding)', () => {
    const token = encodePresentationToken({ ids: ['a', 'b', 'c'], exp: 123 });
    expect(token).not.toMatch(/[+/=]/);
  });

  describe('rejects tampered or malformed input', () => {
    it('returns null for non-base64 garbage', () => {
      expect(decodePresentationToken('not a token!!!')).toBeNull();
    });

    it('returns null for valid base64 that is not JSON', () => {
      const token = btoa('this is plain text, not json').replace(/=+$/, '');
      expect(decodePresentationToken(token)).toBeNull();
    });

    it('returns null when ids is missing', () => {
      const token = btoa(JSON.stringify({ exp: 123 })).replace(/=+$/, '');
      expect(decodePresentationToken(token)).toBeNull();
    });

    it('returns null when ids is not an array', () => {
      const token = btoa(JSON.stringify({ ids: 'cred-a', exp: 123 })).replace(/=+$/, '');
      expect(decodePresentationToken(token)).toBeNull();
    });

    it('returns null when ids is an empty array', () => {
      const token = btoa(JSON.stringify({ ids: [], exp: null })).replace(/=+$/, '');
      expect(decodePresentationToken(token)).toBeNull();
    });

    it('returns null for a JSON literal that is not an object', () => {
      const token = btoa(JSON.stringify(42)).replace(/=+$/, '');
      expect(decodePresentationToken(token)).toBeNull();
    });

    it('returns null for an empty token', () => {
      expect(decodePresentationToken('')).toBeNull();
    });
  });
});
