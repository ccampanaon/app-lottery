import type { Types } from 'mongoose';
import { getTargetDrawDate } from '@/lib/draw-schedule';
import { getDraws } from '@/lib/powerball-feed';
import { scorePrediction } from '@/lib/prediction';
import type { Draw, PredictionDTO, Strategy } from '@/types';

/**
 * Every read of predictions must carry this.
 *
 * Soft-deleted rows stay in the collection forever, so a query that omits it
 * silently resurrects deleted predictions into lists, scores and totals. It is a
 * single exported constant rather than an inline `{ deletedAt: null }` so there
 * is one place to find every read path.
 */
export const ACTIVE_ONLY = { deletedAt: null } as const;

/** Scope a query to one user's live predictions. */
export function ownedActive(userId: string | Types.ObjectId) {
  return { createdBy: userId, ...ACTIVE_ONLY };
}

export type PredictionRow = {
  _id: unknown;
  targetDrawDate: Date;
  strategy: string;
  sets: { numbers: number[]; powerball: number; strategy: string; rationale?: string }[];
  analysisWindow: number | null;
  createdAt: Date;
};

/**
 * Shape a stored prediction for the wire, scoring it if its draw has happened.
 *
 * A prediction whose target draw is still in the future simply has no
 * `outcome` — that is the normal state, not missing data.
 */
export function toPredictionDTO(row: PredictionRow, drawsByDate: Map<string, Draw>): PredictionDTO {
  const targetDrawDate = row.targetDrawDate.toISOString();
  const sets = row.sets.map((set) => ({
    numbers: set.numbers,
    powerball: set.powerball,
    strategy: set.strategy as Strategy,
    rationale: set.rationale,
  }));

  const actual = drawsByDate.get(targetDrawDate.slice(0, 10));

  return {
    id: String(row._id),
    targetDrawDate,
    strategy: row.strategy as Strategy,
    sets,
    analysisWindow: row.analysisWindow,
    createdAt: row.createdAt.toISOString(),
    ...(actual ? { outcome: scorePrediction(sets, actual) } : {}),
  };
}

/** Index the feed by calendar date so scoring is a lookup rather than a scan. */
export function indexDrawsByDate(draws: Draw[]): Map<string, Draw> {
  return new Map(draws.map((d) => [d.drawDate.slice(0, 10), d]));
}

/**
 * The draw predictions should currently target: the next scheduled draw after
 * the most recent published result.
 */
export async function resolveTargetDraw(): Promise<{ targetDrawDate: string; draws: Draw[] }> {
  const { draws } = await getDraws();
  const latest = draws[0];

  return {
    targetDrawDate: latest
      ? getTargetDrawDate(new Date(latest.drawDate)).toISOString()
      : new Date().toISOString(),
    draws,
  };
}
