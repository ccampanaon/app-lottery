import type { NextRequest } from 'next/server';
import { failValidation, handleRoute, ok, requireUser } from '@/lib/api';
import { getDraws } from '@/lib/powerball-feed';
import { drawListQuerySchema } from '@/lib/validation/draw';
import type { DrawPage } from '@/types';

// `auth()` pulls in Mongoose via the credentials provider, which needs Node.
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleRoute<DrawPage>(async () => {
    await requireUser();

    const parsed = drawListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return failValidation(parsed.error);

    const { page, limit, sort, from, to } = parsed.data;
    const { draws, stale, fetchedAt } = await getDraws();

    // drawDate is `YYYY-MM-DDT00:00:00.000Z`, so a prefix comparison is an exact
    // calendar-date comparison — no Date construction, no timezone surprises.
    let filtered = draws;
    if (from) filtered = filtered.filter((d) => d.drawDate.slice(0, 10) >= from);
    if (to) filtered = filtered.filter((d) => d.drawDate.slice(0, 10) <= to);

    // The feed is cached newest-first; only the ascending request needs work.
    const ordered = sort === 'drawDate' ? [...filtered].reverse() : filtered;

    const total = ordered.length;
    const start = (page - 1) * limit;

    return ok<DrawPage>({
      data: ordered.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stale,
      fetchedAt,
    });
  });
}
