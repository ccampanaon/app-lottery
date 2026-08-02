'use client';

import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { BallRow } from './NumberBall';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDraws, type DrawsQuery } from '@/hooks/useDraws';
import { consecutivePairs, drawSum, formatDrawDate, highCount, oddCount } from '@/lib/draw-utils';
import { WHITE_BALL_COUNT } from '@/lib/constants';

const PAGE_SIZES = [25, 50, 100];

export function DrawsTable() {
  const [query, setQuery] = useState<DrawsQuery>({ page: 1, limit: 25, sort: '-drawDate' });
  const { data, isPending, isError, error, isFetching, refetch } = useDraws(query);

  // Any filter or sort change invalidates the current page number.
  function update(patch: Partial<DrawsQuery>) {
    setQuery((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="from" className="text-muted-foreground block text-xs font-medium">
            From
          </label>
          <Input
            id="from"
            type="date"
            className="w-40"
            value={query.from ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="to" className="text-muted-foreground block text-xs font-medium">
            To
          </label>
          <Input
            id="to"
            type="date"
            className="w-40"
            value={query.to ?? ''}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>

        {(query.from || query.to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ from: undefined, to: undefined })}
          >
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {data && (
            <span className="text-muted-foreground text-sm">
              {data.total.toLocaleString()} draw{data.total === 1 ? '' : 's'}
              {data.stale && (
                <span className="text-warning ml-2" title="The live feed could not be reached">
                  cached
                </span>
              )}
            </span>
          )}
          <select
            aria-label="Rows per page"
            value={query.limit}
            onChange={(e) => update({ limit: Number(e.target.value) })}
            className="bg-input border-border h-9 rounded-md border px-2 text-sm"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-lg border">
        {/* The table scrolls inside this box rather than the page. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  <button
                    onClick={() =>
                      update({ sort: query.sort === '-drawDate' ? 'drawDate' : '-drawDate' })
                    }
                    className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                  >
                    Draw date
                    <ArrowUpDown className="size-3.5" aria-hidden />
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Numbers
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Sum
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                  Odd/Even
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium md:table-cell">
                  High/Low
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium lg:table-cell">
                  Power Play
                </th>
              </tr>
            </thead>

            <tbody>
              {isPending &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-border/50 border-b last:border-0">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-9 w-64 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                  </tr>
                ))}

              {data?.data.map((draw) => {
                const odd = oddCount(draw);
                const high = highCount(draw);
                const runs = consecutivePairs(draw.numbers);

                return (
                  <tr
                    key={draw.drawDate}
                    className="border-border/50 hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatDrawDate(draw.drawDate)}</td>
                    <td className="px-4 py-3">
                      <BallRow numbers={draw.numbers} powerball={draw.powerball} size="sm" />
                      {runs > 0 && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {runs} consecutive pair{runs === 1 ? '' : 's'}
                        </span>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{drawSum(draw)}</td>
                    <td className="tabular hidden px-4 py-3 text-right sm:table-cell">
                      {odd}/{WHITE_BALL_COUNT - odd}
                    </td>
                    <td className="tabular hidden px-4 py-3 text-right md:table-cell">
                      {high}/{WHITE_BALL_COUNT - high}
                    </td>
                    <td className="tabular text-muted-foreground hidden px-4 py-3 text-right lg:table-cell">
                      {draw.multiplier ? `${draw.multiplier}x` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isError && (
          <ErrorState
            message={error instanceof Error ? error.message : 'Could not load draws'}
            onRetry={() => refetch()}
          />
        )}

        {data && data.data.length === 0 && (
          <EmptyState
            title="No draws in this range"
            description="Try widening the date filter — the published history starts on 7 October 2015."
          />
        )}
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Page {data.page} of {totalPages}
            {isFetching && <span className="ml-2 opacity-60">updating…</span>}
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => update({ page: data.page - 1 })}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={data.page >= totalPages}
              onClick={() => update({ page: data.page + 1 })}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
