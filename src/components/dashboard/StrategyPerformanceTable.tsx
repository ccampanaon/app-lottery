'use client';

import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useStrategyPerformance } from '@/hooks/useStrategyPerformance';
import { STRATEGY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Per-strategy totals across every published draw.
 *
 * A table rather than a chart: seven strategies with six metrics each is a grid
 * of numbers, and bars would compress the differences into noise — the gaps
 * between strategies here are one or two matches wide.
 */
export function StrategyPerformanceTable() {
  const { data, isPending, isError, error, refetch } = useStrategyPerformance();

  if (isPending) {
    return (
      <section className="border-border bg-card rounded-lg border p-4 sm:p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-40 w-full" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="border-border bg-card rounded-lg border p-4 sm:p-5">
        <ErrorState
          message={error instanceof Error ? error.message : 'Could not load strategy performance'}
          onRetry={() => refetch()}
        />
      </section>
    );
  }

  return (
    <section className="border-border bg-card rounded-lg border p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Strategy performance</h2>
        <p className="text-muted-foreground text-xs">
          {data.drawsScored} scored draw{data.drawsScored === 1 ? '' : 's'}
          {data.pendingDraws > 0 && ` · ${data.pendingDraws} awaiting`}
        </p>
      </div>
      <p className="text-muted-foreground mb-4 text-xs">
        Total winning numbers each strategy has found across every published draw. Compare each
        total with its <strong className="font-medium">expected</strong> column — a strategy that
        plays more distinct numbers covers more of the draw for free, so a bigger total is not
        automatically a better strategy.
      </p>

      {data.strategies.length === 0 ? (
        <EmptyState
          title="Nothing scored yet"
          description="Once a draw you generated numbers for has been published, each strategy's running total appears here."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Strategy
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Matches
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Expected
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                  Per draw
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-medium md:table-cell">
                  Best line
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-medium md:table-cell">
                  PB hits
                </th>
                <th scope="col" className="hidden py-2 text-right font-medium lg:table-cell">
                  Draws
                </th>
              </tr>
            </thead>

            <tbody>
              {data.strategies.map((row) => {
                const beatingChance = row.totalMatches > row.expectedMatches;

                return (
                  <tr key={row.strategy} className="border-border/50 border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{STRATEGY_LABELS[row.strategy]}</td>

                    <td className="tabular py-2 pr-3 text-right">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-semibold',
                          row.totalMatches > 0
                            ? 'bg-success/15 text-success'
                            : 'text-muted-foreground',
                        )}
                      >
                        {row.totalMatches}
                      </span>
                    </td>

                    <td className="tabular text-muted-foreground py-2 pr-3 text-right">
                      {row.expectedMatches.toFixed(1)}
                      {/* Above or below the fair baseline, stated plainly. */}
                      <span className="ml-1 text-xs opacity-70">
                        {beatingChance ? '▲' : row.totalMatches < row.expectedMatches ? '▼' : '='}
                      </span>
                    </td>

                    <td className="tabular hidden py-2 pr-3 text-right sm:table-cell">
                      {row.averageMatches.toFixed(2)}
                    </td>

                    <td className="tabular hidden py-2 pr-3 text-right md:table-cell">
                      {row.bestSingleLine} of 5
                    </td>

                    <td className="tabular hidden py-2 pr-3 text-right md:table-cell">
                      {row.powerballHits}
                    </td>

                    <td className="tabular text-muted-foreground hidden py-2 text-right lg:table-cell">
                      {row.drawsScored}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="text-muted-foreground mt-3 text-xs">
            <strong className="font-medium">Matches</strong> counts distinct winning numbers a
            strategy covered, summed over draws — spread across separate tickets it wins nothing, so{' '}
            <strong className="font-medium">Best line</strong> is the column that maps to a prize.
            With enough draws every strategy converges on its expected value; a lead here is noise,
            not skill.
          </p>
        </div>
      )}
    </section>
  );
}
