import { Types } from 'mongoose';
import { handleRoute, ok, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import { getDraws } from '@/lib/powerball-feed';
import { computeStrategyPerformance, type StrategyPerformance } from '@/lib/prediction/performance';
import { ACTIVE_ONLY, indexDrawsByDate } from '@/lib/predictions-service';
import { Prediction } from '@/models/Prediction';

export const runtime = 'nodejs';

export type PerformanceResponse = {
  strategies: StrategyPerformance[];
  /** Distinct published draws that contributed to these totals. */
  drawsScored: number;
  /** Predictions still waiting on their draw, so the totals read in context. */
  pendingDraws: number;
};

/**
 * How each strategy has actually done across every past draw.
 *
 * Every record is loaded rather than paginated: this is an aggregate over the
 * user's whole history, and a page of it would be a different number.
 */
export async function GET() {
  return handleRoute<PerformanceResponse>(async () => {
    const user = await requireUser();
    await connectToDatabase();

    const createdBy = new Types.ObjectId(user.id);

    const [rows, feed] = await Promise.all([
      Prediction.find({ createdBy, ...ACTIVE_ONLY })
        .select('strategy targetDrawDate sets')
        .lean<
          {
            strategy: string;
            targetDrawDate: Date;
            sets: { numbers: number[]; powerball: number }[];
          }[]
        >(),
      getDraws(),
    ]);

    const drawsByDate = indexDrawsByDate(feed.draws);

    const predictions = rows.map((row) => ({
      strategy: row.strategy as StrategyPerformance['strategy'],
      targetDrawDate: row.targetDrawDate.toISOString(),
      sets: row.sets,
    }));

    const strategies = computeStrategyPerformance(predictions, drawsByDate);

    const scoredDates = new Set<string>();
    const pendingDates = new Set<string>();
    for (const prediction of predictions) {
      const key = prediction.targetDrawDate.slice(0, 10);
      (drawsByDate.has(key) ? scoredDates : pendingDates).add(key);
    }

    return ok<PerformanceResponse>({
      strategies,
      drawsScored: scoredDates.size,
      pendingDraws: pendingDates.size,
    });
  });
}
