/**
 * Presentation link token codec shared between the share flow (#7) and the
 * public verify view (#20). Payload is base64url-encoded JSON.
 */
export interface PresentationPayload {
  ids: string[];
  exp: number | null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(token: string): string {
  const base64 = token
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(token.length + ((4 - (token.length % 4)) % 4), '=');

  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

export function encodePresentationToken(payload: PresentationPayload): string {
  const jsonStr = JSON.stringify(payload);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  return base64UrlEncode(utf8Bytes);
}

export function decodePresentationToken(token: string): PresentationPayload | null {
  try {
    const jsonStr = base64UrlDecode(token);
    const parsed = JSON.parse(jsonStr) as PresentationPayload;

    if (!parsed || !Array.isArray(parsed.ids) || parsed.ids.length === 0) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
