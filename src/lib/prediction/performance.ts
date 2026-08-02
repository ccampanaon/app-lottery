import { PREDICTION_STRATEGIES } from '@/lib/constants';
import type { Draw, Strategy } from '@/types';
import {
  countCoverage,
  countMatches,
  distinctNumbersPlayed,
  expectedCoverage,
  type PlayedLine,
} from './score';

export type StrategyPerformance = {
  strategy: Strategy;
  /** Past draws this strategy predicted for and that have since been published. */
  drawsScored: number;
  /** Sum of per-draw coverage — the headline "total matches". */
  totalMatches: number;
  /** Best single playable line across every draw. */
  bestSingleLine: number;
  /** Draws where at least one set matched the Powerball. */
  powerballHits: number;
  totalSets: number;
  /** totalMatches / drawsScored. */
  averageMatches: number;
  /**
   * What a random pick of the same breadth would have scored. A strategy that
   * plays more distinct numbers covers more of the draw for free, so the total
   * only means something next to this.
   */
  expectedMatches: number;
};

export type ScorablePrediction = {
  strategy: Strategy;
  targetDrawDate: string;
  sets: PlayedLine[];
};

/**
 * Per-strategy totals across every draw that has actually been published.
 *
 * Predictions whose target draw is still pending are skipped — counting them
 * would drag every average toward zero for reasons that have nothing to do with
 * how the strategy performed.
 */
export function computeStrategyPerformance(
  predictions: ScorablePrediction[],
  drawsByDate: Map<string, Draw>,
): StrategyPerformance[] {
  const accumulator = new Map<
    Strategy,
    {
      drawsScored: number;
      totalMatches: number;
      bestSingleLine: number;
      powerballHits: number;
      totalSets: number;
      expectedMatches: number;
    }
  >();

  for (const prediction of predictions) {
    const actual = drawsByDate.get(prediction.targetDrawDate.slice(0, 10));
    if (!actual) continue;

    const entry = accumulator.get(prediction.strategy) ?? {
      drawsScored: 0,
      totalMatches: 0,
      bestSingleLine: 0,
      powerballHits: 0,
      totalSets: 0,
      expectedMatches: 0,
    };

    const coverage = countCoverage(prediction.sets, actual);
    const bestLine = prediction.sets.reduce(
      (best, set) => Math.max(best, countMatches(set.numbers, set.powerball, actual).whiteHits),
      0,
    );

    entry.drawsScored += 1;
    entry.totalMatches += coverage.whiteHits;
    entry.bestSingleLine = Math.max(entry.bestSingleLine, bestLine);
    entry.powerballHits += coverage.powerballHit ? 1 : 0;
    entry.totalSets += prediction.sets.length;
    entry.expectedMatches += expectedCoverage(distinctNumbersPlayed(prediction.sets));

    accumulator.set(prediction.strategy, entry);
  }

  return (
    PREDICTION_STRATEGIES.filter((strategy) => accumulator.has(strategy))
      .map((strategy) => {
        const entry = accumulator.get(strategy)!;
        return {
          strategy,
          ...entry,
          averageMatches: entry.drawsScored === 0 ? 0 : entry.totalMatches / entry.drawsScored,
          expectedMatches: entry.expectedMatches,
        };
      })
      // Best total first; ties broken by the best single line, then fewer draws.
      .sort(
        (a, b) =>
          b.totalMatches - a.totalMatches ||
          b.bestSingleLine - a.bestSingleLine ||
          a.strategy.localeCompare(b.strategy),
      )
  );
}
