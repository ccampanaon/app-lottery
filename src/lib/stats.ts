import { POWERBALL_RANGE, WHITE_BALL_COUNT, WHITE_BALL_RANGE } from '@/lib/constants';
import { drawSum, highCount, oddCount } from '@/lib/draw-utils';
import type { Draw } from '@/types';

export type NumberFrequency = {
  number: number;
  count: number;
  /** Draws since this number last appeared; null if it never has. */
  gap: number | null;
};

export type Bucket = { label: string; count: number };

export type Stats = {
  totalDraws: number;
  /** How many draws were analysed — equals totalDraws unless a window was set. */
  analysed: number;
  latest: Draw | null;
  firstDrawDate: string | null;
  whiteFrequency: NumberFrequency[];
  powerballFrequency: NumberFrequency[];
  hottestWhite: NumberFrequency | null;
  coldestWhite: NumberFrequency | null;
  mostOverdueWhite: NumberFrequency | null;
  hottestPowerball: NumberFrequency | null;
  sumBuckets: Bucket[];
  oddEvenSplit: Bucket[];
  highLowSplit: Bucket[];
  averageSum: number;
};

/**
 * Frequency and gap for every number in a pool.
 *
 * `draws` must be newest-first — the gap is the index of the most recent draw
 * containing the number, i.e. how many draws have passed since it appeared.
 */
function tally(draws: Draw[], pool: number[], pick: (draw: Draw) => number[]): NumberFrequency[] {
  const counts = new Map<number, number>();
  const lastSeen = new Map<number, number>();

  draws.forEach((draw, index) => {
    for (const n of pick(draw)) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
      if (!lastSeen.has(n)) lastSeen.set(n, index);
    }
  });

  return pool.map((number) => ({
    number,
    count: counts.get(number) ?? 0,
    gap: lastSeen.get(number) ?? null,
  }));
}

/** Histogram of the five-ball sum. Most draws land between 120 and 190. */
function bucketSums(draws: Draw[]): Bucket[] {
  const edges = [0, 70, 100, 130, 160, 190, 220, 250, Infinity];
  const labels = ['<70', '70-99', '100-129', '130-159', '160-189', '190-219', '220-249', '250+'];
  const counts = new Array(labels.length).fill(0) as number[];

  for (const draw of draws) {
    const sum = drawSum(draw);
    const index = edges.findIndex((edge, i) => sum >= edge && sum < edges[i + 1]);
    if (index >= 0) counts[index] += 1;
  }

  return labels.map((label, i) => ({ label, count: counts[i] }));
}

/** Split distribution, e.g. how many draws were 3 odd / 2 even. */
function bucketSplit(draws: Draw[], count: (draw: Draw) => number, unit: string): Bucket[] {
  const counts = new Array(WHITE_BALL_COUNT + 1).fill(0) as number[];
  for (const draw of draws) counts[count(draw)] += 1;

  return counts.map((n, i) => ({
    label: `${i} ${unit} / ${WHITE_BALL_COUNT - i}`,
    count: n,
  }));
}

function extreme(
  list: NumberFrequency[],
  compare: (a: NumberFrequency, b: NumberFrequency) => number,
) {
  if (list.length === 0) return null;
  return [...list].sort(compare)[0];
}

/**
 * Aggregate a set of draws.
 *
 * @param allDraws newest-first, as served by the feed
 * @param window   analyse only the most recent N draws; omit for the full history
 */
export function computeStats(allDraws: Draw[], window?: number): Stats {
  const draws = window ? allDraws.slice(0, window) : allDraws;

  const whiteFrequency = tally(draws, WHITE_BALL_RANGE, (d) => d.numbers);
  const powerballFrequency = tally(draws, POWERBALL_RANGE, (d) => [d.powerball]);

  const totalSum = draws.reduce((total, d) => total + drawSum(d), 0);

  return {
    totalDraws: allDraws.length,
    analysed: draws.length,
    latest: draws[0] ?? null,
    firstDrawDate: draws.at(-1)?.drawDate ?? null,
    whiteFrequency,
    powerballFrequency,
    hottestWhite: extreme(whiteFrequency, (a, b) => b.count - a.count || a.number - b.number),
    coldestWhite: extreme(whiteFrequency, (a, b) => a.count - b.count || a.number - b.number),
    // A number that has never appeared has no gap; treat it as maximally overdue.
    mostOverdueWhite: extreme(
      whiteFrequency,
      (a, b) => (b.gap ?? Infinity) - (a.gap ?? Infinity) || a.number - b.number,
    ),
    hottestPowerball: extreme(
      powerballFrequency,
      (a, b) => b.count - a.count || a.number - b.number,
    ),
    sumBuckets: bucketSums(draws),
    oddEvenSplit: bucketSplit(draws, oddCount, 'odd'),
    highLowSplit: bucketSplit(draws, highCount, 'high'),
    averageSum: draws.length === 0 ? 0 : Math.round(totalSum / draws.length),
  };
}
