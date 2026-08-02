import { WHITE_BALL_COUNT, WHITE_BALL_MAX } from '@/lib/constants';
import type { Draw, PredictionOutcome, PredictionSetDTO } from '@/types';

export type MatchSummary = { whiteHits: number; powerballHit: boolean };

/** A played line — the minimum shape scoring needs. */
export type PlayedLine = { numbers: number[]; powerball: number };

/** Count one played line against the draw that actually happened. */
export function countMatches(numbers: number[], powerball: number, actual: Draw): MatchSummary {
  const drawn = new Set(actual.numbers);
  return {
    whiteHits: numbers.filter((n) => drawn.has(n)).length,
    powerballHit: powerball === actual.powerball,
  };
}

/**
 * Distinct winning numbers covered across several lines.
 *
 * Deliberately different from a per-line count: prizes are won per ticket, so
 * three numbers spread over three sets wins nothing, while three on one line is
 * a Match 3. Coverage measures how much of the winning line a strategy found —
 * useful for comparing strategies, not a claim about winnings.
 */
export function countCoverage(sets: PlayedLine[], actual: Draw): MatchSummary {
  const drawn = new Set(actual.numbers);
  const covered = new Set<number>();
  let powerballHit = false;

  for (const set of sets) {
    for (const n of set.numbers) {
      if (drawn.has(n)) covered.add(n);
    }
    if (set.powerball === actual.powerball) powerballHit = true;
  }

  return { whiteHits: covered.size, powerballHit };
}

/** Every distinct white ball a group of lines has in play. */
export function distinctNumbersPlayed(sets: PlayedLine[]): number {
  const played = new Set<number>();
  for (const set of sets) {
    for (const n of set.numbers) played.add(n);
  }
  return played.size;
}

/**
 * Coverage a fair random pick of the same breadth would be expected to score.
 *
 * Playing `k` distinct numbers out of 69 covers, on average,
 * `5 x k / 69` of the five drawn — the honest yardstick for any strategy's
 * total, and the reason a bigger total can simply mean more numbers played.
 */
export function expectedCoverage(distinctPlayed: number): number {
  return (WHITE_BALL_COUNT * distinctPlayed) / WHITE_BALL_MAX;
}

/**
 * Prize tiers, so a scored prediction can say what it would actually have won
 * rather than just counting matches.
 */
export function prizeTier(whiteHits: number, powerballHit: boolean): string | null {
  if (whiteHits === 5 && powerballHit) return 'Jackpot';
  if (whiteHits === 5) return 'Match 5';
  if (whiteHits === 4 && powerballHit) return 'Match 4 + PB';
  if (whiteHits === 4) return 'Match 4';
  if (whiteHits === 3 && powerballHit) return 'Match 3 + PB';
  if (whiteHits === 3) return 'Match 3';
  if (whiteHits === 2 && powerballHit) return 'Match 2 + PB';
  if (whiteHits === 1 && powerballHit) return 'Match 1 + PB';
  if (powerballHit) return 'Powerball only';
  return null;
}

/** Score every set in a prediction against the draw that actually happened. */
export function scorePrediction(sets: PredictionSetDTO[], actual: Draw): PredictionOutcome {
  const actualWhites = new Set(actual.numbers);

  const setResults = sets.map((set) => ({
    whiteHits: set.numbers.filter((n) => actualWhites.has(n)).length,
    powerballHit: set.powerball === actual.powerball,
  }));

  return {
    actual,
    setResults,
    bestWhiteHits: setResults.reduce((best, r) => Math.max(best, r.whiteHits), 0),
  };
}
