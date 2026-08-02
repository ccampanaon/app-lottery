import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { failValidation, handleRoute, ok, requireUser } from '@/lib/api';
import { getDraws } from '@/lib/powerball-feed';
import { computeStats, type Stats } from '@/lib/stats';

export const runtime = 'nodejs';

const querySchema = z.object({
  /** Analyse only the most recent N draws; omitted means the full history. */
  window: z.coerce.number().int().min(10).max(5000).optional(),
});

export type StatsResponse = Stats & { stale: boolean; fetchedAt: number };

export async function GET(request: NextRequest) {
  return handleRoute<StatsResponse>(async () => {
    await requireUser();

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return failValidation(parsed.error);

    const { draws, stale, fetchedAt } = await getDraws();

    return ok<StatsResponse>({
      ...computeStats(draws, parsed.data.window),
      stale,
      fetchedAt,
    });
  });
}
