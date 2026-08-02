import type { Types } from 'mongoose';
import type { NextRequest } from 'next/server';
import { fail, failValidation, handleRoute, ok, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import {
  indexDrawsByDate,
  ownedActive,
  resolveTargetDraw,
  toPredictionDTO,
  type PredictionRow,
} from '@/lib/predictions-service';
import { createContext, generateAllSync, type StrategyGroup } from '@/lib/prediction';
import { ModelUnavailableError, generateNeuralSets } from '@/lib/prediction/ml';
import { generateQuerySchema } from '@/lib/validation/prediction';
import { Prediction } from '@/models/Prediction';
import type { CurrentPrediction } from '@/types';

export const runtime = 'nodejs';

/** Mongo's duplicate-key error, raised by the unique (user, draw, strategy) index. */
function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Generate every strategy for the next draw and persist the results.
 *
 * POST, not GET: this writes. One generation per draw — a second call returns
 * 409 rather than producing a competing set of numbers for the same draw.
 */
export async function POST(request: NextRequest) {
  return handleRoute<CurrentPrediction>(async () => {
    const user = await requireUser();

    const parsed = generateQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return failValidation(parsed.error);

    const { sets: count, window } = parsed.data;
    const [{ targetDrawDate, draws }] = await Promise.all([
      resolveTargetDraw(),
      connectToDatabase(),
    ]);

    // Soft-deleted rows must not count, or deleting a generation would leave
    // the draw permanently un-regeneratable.
    const existing = await Prediction.countDocuments({
      ...ownedActive(user.id),
      targetDrawDate: new Date(targetDrawDate),
    });
    if (existing > 0) {
      return fail(409, 'Numbers have already been generated for this draw.');
    }

    const context = createContext(draws, window);
    const groups: StrategyGroup[] = generateAllSync(context, count);

    /*
     * The neural strategy is async and needs a trained model. If it is missing,
     * the other six are still generated and saved — an untrained model should
     * not block the whole draw.
     */
    try {
      groups.push({
        strategy: 'neural',
        sets: await generateNeuralSets(context.draws, count, context.rng),
      });
    } catch (error) {
      if (!(error instanceof ModelUnavailableError)) {
        console.error('[predictions] neural strategy failed', error);
      }
    }

    const documents = groups
      .filter((group) => group.sets.length > 0)
      .map((group) => ({
        targetDrawDate: new Date(targetDrawDate),
        strategy: group.strategy,
        sets: group.sets,
        analysisWindow: window ?? null,
        createdBy: user.id,
      }));

    if (documents.length === 0) {
      return fail(500, 'No strategy produced any numbers.');
    }

    try {
      await Prediction.insertMany(documents, { ordered: true });
    } catch (error) {
      /*
       * All-or-nothing. `ordered: false` would leave whichever documents
       * happened to succeed behind, and a single orphan record is enough to make
       * the draw look generated — so the page would show one strategy and refuse
       * to produce the rest. Undo any partial write before reporting.
       */
      const partial = (error as { insertedDocs?: { _id: Types.ObjectId }[] }).insertedDocs ?? [];
      if (partial.length > 0) {
        /*
         * Goes through the raw driver to bypass the model's hard-delete guard.
         * That guard protects records the user owns; these were written seconds
         * ago by this very request, were never returned to anyone, and would
         * otherwise linger as soft-deleted noise for a generation that failed.
         */
        await Prediction.collection.deleteMany({ _id: { $in: partial.map((doc) => doc._id) } });
      }

      // Two clicks can both pass the count check above; the unique index is what
      // actually decides, so a duplicate here means the other one won.
      if (isDuplicateKeyError(error)) {
        return fail(409, 'Numbers have already been generated for this draw.');
      }
      throw error;
    }

    const saved = await Prediction.find({
      ...ownedActive(user.id),
      targetDrawDate: new Date(targetDrawDate),
    })
      .sort({ createdAt: 1 })
      .lean<PredictionRow[]>();

    const drawsByDate = indexDrawsByDate(draws);

    return ok<CurrentPrediction>(
      {
        targetDrawDate,
        generated: true,
        predictions: saved.map((row) => toPredictionDTO(row, drawsByDate)),
        analysisWindow: window ?? null,
        drawsAnalysed: context.draws.length,
      },
      { status: 201 },
    );
  });
}
