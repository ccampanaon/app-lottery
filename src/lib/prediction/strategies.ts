import { WHITE_BALL_COUNT } from '@/lib/constants';
import type { NumberFrequency } from '@/lib/stats';
import { sampleWithoutReplacement, samplePowerball, type Weighted } from './rng';
import type { Generator, GeneratorContext } from './types';

/** How many of the ranked candidates each strategy samples from. */
const WHITE_CANDIDATE_POOL = 18;
const POWERBALL_CANDIDATE_POOL = 8;

function format(numbers: number[]): string {
  return numbers.map((n) => String(n).padStart(2, '0')).join(', ');
}

function topBy(
  list: NumberFrequency[],
  score: (item: NumberFrequency) => number,
  size: number,
): NumberFrequency[] {
  return [...list].sort((a, b) => score(b) - score(a) || a.number - b.number).slice(0, size);
}

function weights(items: NumberFrequency[], score: (item: NumberFrequency) => number): Weighted[] {
  return items.map((item) => ({ value: item.number, weight: score(item) }));
}

/** Powerball pick shared by the strategies that have no opinion of their own. */
function hotPowerball(context: GeneratorContext, powerballFrequency: NumberFrequency[]): number {
  const candidates = topBy(powerballFrequency, (f) => f.count, POWERBALL_CANDIDATE_POOL);
  // +1 smoothing so a Powerball with zero appearances stays possible.
  return samplePowerball(
    weights(candidates, (f) => f.count + 1),
    context.rng,
  );
}

/**
 * Hot numbers — sampled from the most frequently drawn, weighted by count.
 *
 * Sampled rather than simply "the top five": a deterministic top-five would
 * return an identical set every time, so asking for ten sets would return the
 * same line ten times.
 */
export const frequencyStrategy: Generator = (context) => {
  const stats = context.stats;
  const candidates = topBy(stats.whiteFrequency, (f) => f.count, WHITE_CANDIDATE_POOL);

  const numbers = sampleWithoutReplacement(
    weights(candidates, (f) => f.count + 1),
    WHITE_BALL_COUNT,
    context.rng,
  );

  const counts = numbers
    .map((n) => stats.whiteFrequency.find((f) => f.number === n)!.count)
    .join(', ');

  return {
    numbers,
    powerball: hotPowerball(context, stats.powerballFrequency),
    strategy: 'frequency',
    rationale: `Sampled from the 18 most-drawn numbers across ${context.draws.length} draws. ${format(numbers)} appeared ${counts} times respectively.`,
  };
};

/**
 * Overdue numbers — those with the largest gap since they last appeared.
 *
 * Worth stating plainly: a long absence does not make a number "due". Each draw
 * is independent, so this ranks history, it does not forecast.
 */
export const overdueStrategy: Generator = (context) => {
  const stats = context.stats;
  const gapOf = (f: NumberFrequency) => f.gap ?? context.draws.length;

  const candidates = topBy(stats.whiteFrequency, gapOf, WHITE_CANDIDATE_POOL);
  const numbers = sampleWithoutReplacement(
    weights(candidates, gapOf),
    WHITE_BALL_COUNT,
    context.rng,
  );

  const gaps = numbers
    .map((n) => {
      const entry = stats.whiteFrequency.find((f) => f.number === n)!;
      return entry.gap === null ? 'never' : String(entry.gap);
    })
    .join(', ');

  return {
    numbers,
    powerball: hotPowerball(context, stats.powerballFrequency),
    strategy: 'overdue',
    rationale: `Sampled from the numbers absent longest. ${format(numbers)} last appeared ${gaps} draws ago.`,
  };
};

/** Every number in play, weighted by how often it has been drawn. */
export const weightedRandomStrategy: Generator = (context) => {
  const stats = context.stats;

  const numbers = sampleWithoutReplacement(
    weights(stats.whiteFrequency, (f) => f.count + 1),
    WHITE_BALL_COUNT,
    context.rng,
  );

  return {
    numbers,
    powerball: hotPowerball(context, stats.powerballFrequency),
    strategy: 'weighted-random',
    rationale: `All 69 numbers were eligible, each weighted by its draw count over ${context.draws.length} draws. This is the closest of the strategies to a fair random pick.`,
  };
};

/** 69x69 matrix of how often each pair of numbers was drawn together. */
export function buildCooccurrence(
  draws: { numbers: number[] }[],
): Map<number, Map<number, number>> {
  const matrix = new Map<number, Map<number, number>>();

  for (const draw of draws) {
    for (const a of draw.numbers) {
      const row = matrix.get(a) ?? new Map<number, number>();
      for (const b of draw.numbers) {
        if (a !== b) row.set(b, (row.get(b) ?? 0) + 1);
      }
      matrix.set(a, row);
    }
  }

  return matrix;
}

/**
 * Frequent pairs — seed on the most common pairing, then grow the set by
 * picking numbers that historically co-occur with what has been chosen.
 */
export const pairsStrategy: Generator = (context) => {
  const matrix = context.cooccurrence();
  const stats = context.stats;

  let bestPair: [number, number] = [1, 2];
  let bestCount = -1;

  for (const [a, row] of matrix) {
    for (const [b, count] of row) {
      // a < b so each pair is considered once, not once per direction.
      if (a < b && (count > bestCount || (count === bestCount && a < bestPair[0]))) {
        bestPair = [a, b];
        bestCount = count;
      }
    }
  }

  const chosen = new Set<number>(bestPair);

  while (chosen.size < WHITE_BALL_COUNT) {
    // Affinity = how often a candidate appeared alongside everything chosen.
    const affinity = new Map<number, number>();
    for (const picked of chosen) {
      for (const [candidate, count] of matrix.get(picked) ?? []) {
        if (!chosen.has(candidate)) {
          affinity.set(candidate, (affinity.get(candidate) ?? 0) + count);
        }
      }
    }

    if (affinity.size === 0) break;

    const pool = [...affinity].map(([value, weight]) => ({ value, weight }));
    chosen.add(sampleWithoutReplacement(pool, 1, context.rng)[0]);
  }

  const numbers = [...chosen].sort((a, b) => a - b);

  return {
    numbers,
    powerball: hotPowerball(context, stats.powerballFrequency),
    strategy: 'pairs',
    rationale: `Seeded with ${format(bestPair)} — the pair drawn together most often (${bestCount} times) — then extended with the numbers that most frequently accompany them.`,
  };
};

/**
 * Positional Markov — what tended to follow the numbers in the most recent draw.
 *
 * Builds successor counts: for consecutive draws n and n+1, every number in n+1
 * is recorded as a successor of every number in n.
 */
export const markovStrategy: Generator = (context) => {
  const { draws } = context;
  const stats = context.stats;
  const successors = new Map<number, Map<number, number>>();

  // draws are newest-first, so draws[i + 1] is the *earlier* draw.
  for (let i = 0; i < draws.length - 1; i += 1) {
    const next = draws[i];
    const previous = draws[i + 1];

    for (const from of previous.numbers) {
      const row = successors.get(from) ?? new Map<number, number>();
      for (const to of next.numbers) {
        row.set(to, (row.get(to) ?? 0) + 1);
      }
      successors.set(from, row);
    }
  }

  const latest = draws[0];
  const scores = new Map<number, number>();

  if (latest) {
    for (const from of latest.numbers) {
      for (const [to, count] of successors.get(from) ?? []) {
        scores.set(to, (scores.get(to) ?? 0) + count);
      }
    }
  }

  const pool: Weighted[] =
    scores.size > 0
      ? [...scores].map(([value, weight]) => ({ value, weight }))
      : stats.whiteFrequency.map((f) => ({ value: f.number, weight: f.count + 1 }));

  const numbers = sampleWithoutReplacement(pool, WHITE_BALL_COUNT, context.rng);

  return {
    numbers,
    powerball: hotPowerball(context, stats.powerballFrequency),
    strategy: 'markov',
    rationale: latest
      ? `Weighted by what historically followed the numbers in the most recent draw (${format(latest.numbers)}) across ${draws.length} draws.`
      : 'No prior draw was available, so numbers were weighted by overall frequency instead.',
  };
};
