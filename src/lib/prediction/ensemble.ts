import { WHITE_BALL_COUNT } from '@/lib/constants';
import { computeStats } from '@/lib/stats';
import { sampleWithoutReplacement, samplePowerball } from './rng';
import {
  balancedShapeStrategy,
  frequencyStrategy,
  markovStrategy,
  overdueStrategy,
  pairsStrategy,
  weightedRandomStrategy,
} from './strategies';
import type { Generator, GeneratorContext } from './types';

/** Strategies that vote, and how much each vote counts. */
const VOTERS: { generator: Generator; weight: number }[] = [
  { generator: frequencyStrategy, weight: 1.2 },
  { generator: overdueStrategy, weight: 1 },
  { generator: pairsStrategy, weight: 1 },
  { generator: markovStrategy, weight: 0.8 },
  { generator: balancedShapeStrategy, weight: 0.8 },
  { generator: weightedRandomStrategy, weight: 0.6 },
];

const ROUNDS = 4;

/**
 * Ensemble — run every other strategy several times and pool the votes.
 *
 * Each voter is run repeatedly because they all sample; a single run of each
 * would make the ensemble a lottery over five sets rather than a consensus.
 */
export const ensembleStrategy: Generator = (context: GeneratorContext) => {
  const votes = new Map<number, number>();
  const powerballVotes = new Map<number, number>();

  for (const { generator, weight } of VOTERS) {
    for (let round = 0; round < ROUNDS; round += 1) {
      const set = generator(context);
      for (const n of set.numbers) {
        votes.set(n, (votes.get(n) ?? 0) + weight);
      }
      powerballVotes.set(set.powerball, (powerballVotes.get(set.powerball) ?? 0) + weight);
    }
  }

  const numbers = sampleWithoutReplacement(
    [...votes].map(([value, weight]) => ({ value, weight })),
    WHITE_BALL_COUNT,
    context.rng,
  );

  const powerball =
    powerballVotes.size > 0
      ? samplePowerball(
          [...powerballVotes].map(([value, weight]) => ({ value, weight })),
          context.rng,
        )
      : (computeStats(context.draws).hottestPowerball?.number ?? 1);

  const topVote = Math.max(...numbers.map((n) => votes.get(n) ?? 0));

  return {
    numbers,
    powerball,
    strategy: 'ensemble',
    rationale: `Pooled ${VOTERS.length * ROUNDS} runs across five strategies, weighted by vote. The strongest number in this set drew ${topVote.toFixed(1)} weighted votes.`,
  };
};
