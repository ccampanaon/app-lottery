type Bucket = { count: number; resetAt: number };

/*
 * In-process fixed-window limiter. Adequate for a single-instance deployment;
 * behind multiple instances each would keep its own count, so a real deployment
 * would move this to Redis or Atlas. Called out in the README rather than left
 * as a silent assumption.
 */
const buckets = new Map<string, Bucket>();

/** Cheap amortised cleanup so the map cannot grow without bound. */
function prune(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Test seam — the limiter is module-level state. */
export function resetRateLimits() {
  buckets.clear();
}
