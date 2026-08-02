import type { PREDICTION_STRATEGIES } from '@/lib/constants';

export type UserRole = 'admin' | 'viewer';

export type Strategy = (typeof PREDICTION_STRATEGIES)[number];

/**
 * A past draw as served by the NY open-data feed. This is *not* a database
 * entity — results are read live and never persisted on our side.
 */
export type Draw = {
  /** ISO string pinned to UTC midnight, e.g. "2026-07-22T00:00:00.000Z". */
  drawDate: string;
  numbers: number[];
  powerball: number;
  multiplier: number | null;
};

/** One playable line within a prediction. */
export type PredictionSetDTO = {
  numbers: number[];
  powerball: number;
  strategy: Strategy;
  rationale?: string;
};

export type PredictionDTO = {
  id: string;
  targetDrawDate: string;
  strategy: Strategy;
  sets: PredictionSetDTO[];
  analysisWindow: number | null;
  createdAt: string;
  /** Present once the target draw has been published and the sets scored. */
  outcome?: PredictionOutcome;
};

/** One draw the user has predicted for, with every strategy grouped under it. */
export type DrawHistoryEntry = {
  targetDrawDate: string;
  /** Derived from the feed; null for draws too old to number reliably. */
  drawNumber: number | null;
  /** The published result, or null while the draw is still pending. */
  actual: Draw | null;
  predictions: PredictionDTO[];
  totalSets: number;
  /** Best white-ball match across every set, once the draw has happened. */
  bestWhiteHits: number | null;
};

/** The saved generation for the upcoming draw, if one exists yet. */
export type CurrentPrediction = {
  targetDrawDate: string;
  /** False when nothing has been generated for this draw yet. */
  generated: boolean;
  predictions: PredictionDTO[];
  analysisWindow: number | null;
  drawsAnalysed: number;
};

/** How a saved prediction fared once its target draw was published. */
export type PredictionOutcome = {
  actual: Draw;
  setResults: {
    /** How many of the five white balls matched. */
    whiteHits: number;
    powerballHit: boolean;
  }[];
  bestWhiteHits: number;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Paginated feed data, plus whether it was served from a stale cache. */
export type DrawPage = Paginated<Draw> & {
  /** True when the upstream fetch failed and the last good copy was served. */
  stale: boolean;
  /** Epoch ms the cache was last refreshed, for a "last updated" label. */
  fetchedAt: number;
};

export type ApiError = {
  error: string;
  /** Field-level messages from a Zod failure, keyed by field path. */
  fields?: Record<string, string[]>;
};
