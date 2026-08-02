import { handleRoute, ok, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import {
  indexDrawsByDate,
  ownedActive,
  resolveTargetDraw,
  toPredictionDTO,
  type PredictionRow,
} from '@/lib/predictions-service';
import { Prediction } from '@/models/Prediction';
import type { CurrentPrediction } from '@/types';

export const runtime = 'nodejs';

/**
 * What has already been generated for the upcoming draw.
 *
 * The predictions page loads this first: if a generation exists it is displayed
 * and the Generate button stays disabled, so one draw gets one set of numbers.
 */
export async function GET() {
  return handleRoute<CurrentPrediction>(async () => {
    const user = await requireUser();

    const [{ targetDrawDate, draws }] = await Promise.all([
      resolveTargetDraw(),
      connectToDatabase(),
    ]);

    const rows = await Prediction.find({
      ...ownedActive(user.id),
      targetDrawDate: new Date(targetDrawDate),
    })
      .sort({ createdAt: 1 })
      .lean<PredictionRow[]>();

    const drawsByDate = indexDrawsByDate(draws);
    const predictions = rows.map((row) => toPredictionDTO(row, drawsByDate));

    return ok<CurrentPrediction>({
      targetDrawDate,
      generated: predictions.length > 0,
      predictions,
      // Every record in one generation shares the window it was produced with.
      analysisWindow: predictions[0]?.analysisWindow ?? null,
      drawsAnalysed: predictions[0]?.analysisWindow ?? draws.length,
    });
  });
}
