/**
 * @fileoverview Basic per-identifier rate limiter for routes that write to
 * durable storage (`POST /api/presentations`, #57).
 *
 * Fixed-window counter held on `globalThis`, same pattern as
 * `presentation-store.ts`'s in-memory map: it survives Next.js dev
 * hot-reloads, and it's process-local, so on serverless it only throttles
 * traffic that happens to land on the same warm instance within a window.
 * That is a deliberately simple, honest trade-off for "keep it simple" — it
 * stops obvious abuse (a script hammering one instance) without adding a
 * shared counter store. If abuse survives this, move the counter into the
 * same durable driver `getPresentationStore()` already selects.
 */

const GLOBAL_KEY = Symbol.for('acta:rate-limit');

type Window = { count: number; resetAt: number };

type GlobalWithLimiter = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, Window>;
};

function windows(): Map<string, Window> {
  const scope = globalThis as GlobalWithLimiter;
  scope[GLOBAL_KEY] ??= new Map<string, Window>();
  return scope[GLOBAL_KEY];
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the caller may retry, when `allowed` is false. */
  retryAfterMs: number;
}

/** Allows `limit` calls per `windowMs`, per `key`. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const store = windows();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort caller identifier: the holder DID when known, else the request IP. */
export function rateLimitKey(request: Request, holder: string | undefined): string {
  if (holder) return `holder:${holder}`;
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim();
  return `ip:${ip ?? 'unknown'}`;
}
