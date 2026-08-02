import { Types } from 'mongoose';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { failValidation, handleRoute, ok, requireUser } from '@/lib/api';
import { connectToDatabase } from '@/lib/db';
import { buildDrawNumbers } from '@/lib/draw-number';
import { getDraws } from '@/lib/powerball-feed';
import {
  ACTIVE_ONLY,
  indexDrawsByDate,
  toPredictionDTO,
  type PredictionRow,
} from '@/lib/predictions-service';
import { Prediction } from '@/models/Prediction';
import type { DrawHistoryEntry, Paginated } from '@/types';

export const runtime = 'nodejs';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Prediction history, one entry per draw rather than one per record.
 *
 * Pagination is by draw, not by prediction: a single generation produces seven
 * records, so paging over records would split one draw across two pages.
 */
export async function GET(request: NextRequest) {
  return handleRoute<Paginated<DrawHistoryEntry>>(async () => {
    const user = await requireUser();

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return failValidation(parsed.error);

    const { page, limit } = parsed.data;
    await connectToDatabase();

    // Aggregation does not apply Mongoose's casting, so the id is cast here.
    const createdBy = new Types.ObjectId(user.id);

    const [dateGroups, distinctDates, feed] = await Promise.all([
      Prediction.aggregate<{ _id: Date }>([
        { $match: { createdBy, ...ACTIVE_ONLY } },
        { $group: { _id: '$targetDrawDate' } },
        { $sort: { _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]),
      Prediction.distinct('targetDrawDate', { createdBy, ...ACTIVE_ONLY }),
      getDraws(),
    ]);

    const dates = dateGroups.map((group) => group._id);

    const rows = await Prediction.find({
      createdBy,
      ...ACTIVE_ONLY,
      targetDrawDate: { $in: dates },
    })
      .sort({ targetDrawDate: -1, createdAt: 1 })
      .lean<PredictionRow[]>();

    const drawsByDate = indexDrawsByDate(feed.draws);
    const drawNumbers = buildDrawNumbers(feed.draws);

    const entries: DrawHistoryEntry[] = dates.map((date) => {
      const iso = date.toISOString();
      const dayKey = iso.slice(0, 10);

      const predictions = rows
        .filter((row) => row.targetDrawDate.getTime() === date.getTime())
        .map((row) => toPredictionDTO(row, drawsByDate));

      const hits = predictions
        .map((p) => p.outcome?.bestWhiteHits)
        .filter((v): v is number => v !== undefined);

      return {
        targetDrawDate: iso,
        drawNumber: drawNumbers.get(dayKey) ?? null,
        actual: drawsByDate.get(dayKey) ?? null,
        predictions,
        totalSets: predictions.reduce((sum, p) => sum + p.sets.length, 0),
        bestWhiteHits: hits.length > 0 ? Math.max(...hits) : null,
      };
    });

    const total = distinctDates.length;

    return ok<Paginated<DrawHistoryEntry>>({
      data: entries,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });
}
