/**
 * @fileoverview Durable `PresentationStore` driver backed by Upstash Redis.
 *
 * Chosen over Vercel KV / Postgres because it is the lowest-friction durable
 * option for this shape of data: an HTTP-based client (no persistent
 * connection to manage across serverless invocations), native per-key TTL
 * that mirrors `expiresAt` so expired links free themselves without a cron
 * job, and a free tier that covers this feature's write volume. Propose an
 * alternative here if usage outgrows it — nothing outside this file and
 * `getPresentationStore()` in `presentation-store.ts` needs to change.
 *
 * Keys:
 *   - `presentation:{ref}` — the JSON-serialised `StoredPresentationRecord`,
 *     with a TTL matching `expiresAt` so it self-expires (a link with no
 *     expiry gets no TTL and lives until explicitly deleted).
 *   - `presentation:holder:{holder}` — a Redis set of every ref that holder
 *     has created. It has no TTL of its own (Redis sets can't expire a single
 *     member); `listByHolder` prunes refs that have expired or vanished as it
 *     reads them, so the set self-cleans lazily instead of growing forever.
 *
 * Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — see the
 * README for how to provision an Upstash Redis database.
 */

import { Redis } from '@upstash/redis';
import type { PresentationStore, StoredPresentationRecord } from '@acta-products/acta/presentation';

const RECORD_PREFIX = 'presentation:';
const HOLDER_SET_PREFIX = 'presentation:holder:';

function recordKey(ref: string): string {
  return `${RECORD_PREFIX}${ref}`;
}

function holderSetKey(holder: string): string {
  return `${HOLDER_SET_PREFIX}${holder}`;
}

/** Seconds until `expiresAt`, floored at 1 so an edge-of-expiry save doesn't set a 0/negative TTL. */
function ttlSeconds(expiresAt: number | null): number | undefined {
  if (expiresAt === null) return undefined;
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

class RedisPresentationStore implements PresentationStore {
  constructor(private readonly redis: Redis) {}

  async save(ref: string, record: StoredPresentationRecord): Promise<void> {
    const ttl = ttlSeconds(record.expiresAt);
    await Promise.all([
      ttl === undefined
        ? this.redis.set(recordKey(ref), record)
        : this.redis.set(recordKey(ref), record, { ex: ttl }),
      this.redis.sadd(holderSetKey(record.holder), ref),
    ]);
  }

  async get(ref: string): Promise<StoredPresentationRecord | null> {
    return (await this.redis.get<StoredPresentationRecord>(recordKey(ref))) ?? null;
  }

  async delete(ref: string): Promise<void> {
    const record = await this.get(ref);
    await this.redis.del(recordKey(ref));
    if (record) {
      await this.redis.srem(holderSetKey(record.holder), ref);
    }
  }

  async listByHolder(holder: string): Promise<StoredPresentationRecord[]> {
    const refs = await this.redis.smembers(holderSetKey(holder));
    if (refs.length === 0) return [];

    const records = await Promise.all(refs.map((ref) => this.get(ref)));
    const stale = refs.filter((_, i) => records[i] === null);
    if (stale.length > 0) {
      await this.redis.srem(holderSetKey(holder), ...stale);
    }

    return records.filter((record): record is StoredPresentationRecord => record !== null);
  }
}

let redisStore: PresentationStore | null = null;

export function getRedisPresentationStore(): PresentationStore {
  if (redisStore) return redisStore;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'PRESENTATION_STORE_DRIVER=upstash-redis requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  redisStore = new RedisPresentationStore(new Redis({ url, token }));
  return redisStore;
}

/** Test seam — lets a test point the driver at a fake/mocked Redis client. */
export function setRedisClientForTesting(redis: Redis | null): void {
  redisStore = redis ? new RedisPresentationStore(redis) : null;
}
