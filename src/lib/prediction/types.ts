import type { Stats } from '@/lib/stats';
import type { Draw, Strategy } from '@/types';

export type GeneratorContext = {
  /** Newest-first, already narrowed to the analysis window. */
  draws: Draw[];
  rng: () => number;
  /**
   * Frequency and gap tables for the window, computed once.
   *
   * Every strategy needs these, and the ensemble runs 20 nested generations —
   * recomputing per call meant tallying 1,379 draws over a hundred times for a
   * single click.
   */
  stats: Stats;
  /** Co-occurrence matrix, built on first use and memoised for the rest. */
  cooccurrence: () => Map<number, Map<number, number>>;
};

export type GeneratedSet = {
  numbers: number[];
  powerball: number;
  strategy: Strategy;
  /** Plain-language account of why these numbers — shown beside every set. */
  rationale: string;
};

export type Generator = (context: GeneratorContext) => GeneratedSet;
