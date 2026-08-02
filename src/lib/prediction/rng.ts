/**
 * mulberry32 — a small, fast, seedable PRNG.
 *
 * Seedable matters here: every strategy samples, so without a fixed seed the
 * unit tests could only assert loose properties. With one they assert exact
 * output, which is what catches an off-by-one in a weighted sampler.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A non-deterministic seed for production use. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

export type Weighted = { value: number; weight: number };

/**
 * Draw `count` distinct values, each with probability proportional to its weight.
 *
 * Weights are floored at a small epsilon rather than zero: a number that has
 * never been drawn must stay *possible*, or "weighted random" would silently
 * become "only numbers that already appeared", which is a different claim.
 */
export function sampleWithoutReplacement(
  pool: Weighted[],
  count: number,
  rng: () => number,
): number[] {
  const remaining = pool.map((item) => ({
    value: item.value,
    weight: Math.max(item.weight, 0.0001),
  }));
  const picked: number[] = [];

  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, item) => sum + item.weight, 0);
    let threshold = rng() * total;

    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i += 1) {
      threshold -= remaining[i].weight;
      if (threshold <= 0) {
        index = i;
        break;
      }
    }

    picked.push(remaining[index].value);
    remaining.splice(index, 1);
  }

  return picked.sort((a, b) => a - b);
}

/** Single weighted pick — the Powerball comes from its own pool. */
export function samplePowerball(pool: Weighted[], rng: () => number): number {
  return sampleWithoutReplacement(pool, 1, rng)[0];
}
