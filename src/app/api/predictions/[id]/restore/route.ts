import { isValidObjectId } from 'mongoose';
import { fail, handleRoute, ok, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import { getDraws } from '@/lib/powerball-feed';
import {
  indexDrawsByDate,
  ownedActive,
  toPredictionDTO,
  type PredictionRow,
} from '@/lib/predictions-service';
import { Prediction } from '@/models/Prediction';
import type { PredictionDTO, Strategy } from '@/types';

export const runtime = 'nodejs';

/**
 * Undo a soft delete.
 *
 * Retaining deleted rows is only worth anything if they can come back, so the
 * restore path ships with the delete rather than being left for later.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute<PredictionDTO>(async () => {
    const user = await requireUser();
    const { id } = await params;

    if (!isValidObjectId(id)) return fail(404, 'Prediction not found');

    await connectToDatabase();

    const target = await Prediction.findOne({
      _id: id,
      createdBy: user.id,
      deletedAt: { $ne: null },
    }).lean<PredictionRow & { targetDrawDate: Date; strategy: string }>();

    if (!target) return fail(404, 'No deleted prediction with that id');

    /*
     * The partial unique index allows only one live record per
     * (user, draw, strategy). If the strategy was regenerated after this one was
     * deleted, restoring would collide — report that plainly instead of letting
     * the write fail with a duplicate-key error.
     */
    const conflict = await Prediction.countDocuments({
      ...ownedActive(user.id),
      targetDrawDate: target.targetDrawDate,
      strategy: target.strategy as Strategy,
    });

    if (conflict > 0) {
      return fail(
        409,
        'That strategy has already been generated again for this draw. Delete the current one first.',
      );
    }

    const restored = await Prediction.findOneAndUpdate(
      { _id: id, createdBy: user.id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null } },
      { new: true },
    ).lean<PredictionRow>();

    if (!restored) return fail(404, 'No deleted prediction with that id');

    const feed = await getDraws();
    return ok<PredictionDTO>(toPredictionDTO(restored, indexDrawsByDate(feed.draws)));
  });
}
