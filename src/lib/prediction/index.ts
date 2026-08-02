import { computeStats } from '@/lib/stats';
import type { Draw, Strategy } from '@/types';
import { ensembleStrategy } from './ensemble';
import { createRng, randomSeed } from './rng';
import {
  buildCooccurrence,
  frequencyStrategy,
  markovStrategy,
  overdueStrategy,
  pairsStrategy,
  weightedRandomStrategy,
} from './strategies';
import type { GeneratedSet, Generator, GeneratorContext } from './types';

export const GENERATORS: Record<Exclude<Strategy, 'neural'>, Generator> = {
  frequency: frequencyStrategy,
  overdue: overdueStrategy,
  'weighted-random': weightedRandomStrategy,
  pairs: pairsStrategy,
  markov: markovStrategy,
  ensemble: ensembleStrategy,
};

/** Every strategy that runs synchronously, in display order. */
export const SYNC_STRATEGIES = Object.keys(GENERATORS) as Exclude<Strategy, 'neural'>[];

export type GenerateOptions = {
  strategy: Strategy;
  count: number;
  /** Analyse only the most recent N draws; omit for the full history. */
  window?: number;
  /** Fix the seed to make the output reproducible — used by the tests. */
  seed?: number;
};

/**
 * Build the shared context once.
 *
 * The stats table and co-occurrence matrix depend only on the window, so they
 * are computed at most once per request and reused by every strategy — which
 * matters now that a single click runs all of them.
 */
export function createContext(draws: Draw[], window?: number, seed?: number): GeneratorContext {
  const windowed = window ? draws.slice(0, window) : draws;

  let matrix: Map<number, Map<number, number>> | null = null;

  return {
    draws: windowed,
    rng: createRng(seed ?? randomSeed()),
    stats: computeStats(windowed),
    cooccurrence: () => (matrix ??= buildCooccurrence(windowed)),
  };
}

/**
 * Produce `count` distinct sets from one strategy.
 *
 * Distinct by construction: strategies sample, so two runs can coincide, and a
 * user asking for ten lines should not be handed the same line twice. The retry
 * budget is bounded because a narrow strategy over a short window genuinely may
 * not have ten distinct sets available.
 */
export function generateWithContext(
  context: GeneratorContext,
  strategy: Exclude<Strategy, 'neural'>,
  count: number,
): GeneratedSet[] {
  const generator = GENERATORS[strategy];
  const sets: GeneratedSet[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 12;

  for (let attempt = 0; attempt < maxAttempts && sets.length < count; attempt += 1) {
    const set = generator(context);
    const key = `${set.numbers.join('-')}|${set.powerball}`;
    if (seen.has(key)) continue;

    seen.add(key);
    sets.push(set);
  }

  return sets;
}

export function generateSets(draws: Draw[], options: GenerateOptions): GeneratedSet[] {
  const { strategy, count, window, seed } = options;

  if (strategy === 'neural') {
    // Inference is async (it loads the model from disk), so it cannot join this
    // synchronous registry. Callers use `generateNeuralSets` from ./ml instead.
    throw new Error('The neural strategy is asynchronous — use generateNeuralSets() instead.');
  }

  return generateWithContext(createContext(draws, window, seed), strategy, count);
}

export type StrategyGroup = {
  strategy: Strategy;
  sets: GeneratedSet[];
  /** Set when a strategy could not run — the others still return. */
  error?: string;
};

/** Run every synchronous strategy over one shared context. */
export function generateAllSync(context: GeneratorContext, count: number): StrategyGroup[] {
  return SYNC_STRATEGIES.map((strategy) => ({
    strategy,
    sets: generateWithContext(context, strategy, count),
  }));
}

export { scorePrediction, prizeTier } from './score';
export type { GeneratedSet } from './types';
