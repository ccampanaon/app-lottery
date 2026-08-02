import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, failValidation, handleRoute, ok, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import { getDraws } from '@/lib/powerball-feed';
import {
  indexDrawsByDate,
  ownedActive,
  toPredictionDTO,
  type PredictionRow,
} from '@/lib/predictions-service';
import { predictionInputSchema } from '@/lib/validation/prediction';
import { Prediction } from '@/models/Prediction';
import type { Paginated, PredictionDTO } from '@/types';

export const runtime = 'nodejs';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: NextRequest) {
  return handleRoute<Paginated<PredictionDTO>>(async () => {
    const user = await requireUser();

    const parsed = listQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return failValidation(parsed.error);

    const { page, limit } = parsed.data;
    await connectToDatabase();

    // Ownership is enforced in the query filter, never in the UI.
    const filter = ownedActive(user.id);

    const [rows, total, feed] = await Promise.all([
      Prediction.find(filter)
        .sort({ targetDrawDate: -1, createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<PredictionRow[]>(),
      Prediction.countDocuments(filter),
      getDraws(),
    ]);

    const drawsByDate = indexDrawsByDate(feed.draws);

    return ok<Paginated<PredictionDTO>>({
      data: rows.map((row) => toPredictionDTO(row, drawsByDate)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute<PredictionDTO>(async () => {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'Request body must be valid JSON');
    }

    const parsed = predictionInputSchema.safeParse(body);
    if (!parsed.success) return failValidation(parsed.error);

    await connectToDatabase();

    try {
      const created = await Prediction.create({
        targetDrawDate: new Date(parsed.data.targetDrawDate),
        // Every set carries its strategy, so the record-level one can be derived.
        strategy: parsed.data.strategy ?? parsed.data.sets[0].strategy,
        sets: parsed.data.sets,
        analysisWindow: parsed.data.analysisWindow ?? null,
        createdBy: user.id,
      });

      const feed = await getDraws();

      return ok<PredictionDTO>(
        toPredictionDTO(
          created.toObject() as unknown as PredictionRow,
          indexDrawsByDate(feed.draws),
        ),
        { status: 201 },
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === 11000
      ) {
        return fail(409, 'That strategy has already been saved for this draw.');
      }
      throw error;
    }
  });
}
