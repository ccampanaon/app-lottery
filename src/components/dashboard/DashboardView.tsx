'use client';

import { useState } from 'react';
import { DistributionChart } from './DistributionChart';
import { FrequencyChart } from './FrequencyChart';
import { StatCard, StatCardSkeleton } from './StatCard';
import { StrategyPerformanceTable } from './StrategyPerformanceTable';
import { BallRow } from '@/components/draws/NumberBall';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useStats } from '@/hooks/useStats';
import { formatDrawDate } from '@/lib/draw-utils';

const WINDOWS = [
  { label: 'Last 50', value: 50 },
  { label: 'Last 100', value: 100 },
  { label: 'Last 250', value: 250 },
  { label: 'All draws', value: undefined },
];

export function DashboardView() {
  const [window, setWindow] = useState<number | undefined>(undefined);
  const { data, isPending, isError, error, refetch } = useStats(window);

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Could not load statistics'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters sit in one row above the charts. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">Analysis window</span>
        <div className="border-border bg-card inline-flex rounded-md border p-0.5">
          {WINDOWS.map((option) => (
            <button
              key={option.label}
              onClick={() => setWindow(option.value)}
              aria-pressed={window === option.value}
              className={
                window === option.value
                  ? 'bg-primary/15 text-foreground rounded px-2.5 py-1 text-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground rounded px-2.5 py-1 text-xs font-medium transition-colors'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        {data?.stale && (
          <span className="text-warning text-xs" title="The live feed could not be reached">
            showing cached data
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Draws analysed"
              value={data.analysed}
              sub={
                data.analysed === data.totalDraws
                  ? 'Full published history'
                  : `of ${data.totalDraws.toLocaleString()} total`
              }
            />

            <StatCard
              label="Latest draw"
              sub={data.latest ? formatDrawDate(data.latest.drawDate) : undefined}
            >
              {data.latest ? (
                <div className="mt-2">
                  <BallRow
                    numbers={data.latest.numbers}
                    powerball={data.latest.powerball}
                    size="sm"
                  />
                </div>
              ) : (
                <p className="mt-1.5 text-2xl font-semibold">—</p>
              )}
            </StatCard>

            <StatCard
              label="Most frequent white ball"
              value={data.hottestWhite ? String(data.hottestWhite.number).padStart(2, '0') : '—'}
              sub={data.hottestWhite ? `Drawn ${data.hottestWhite.count} times` : undefined}
            />

            <StatCard
              label="Most frequent Powerball"
              value={
                data.hottestPowerball ? String(data.hottestPowerball.number).padStart(2, '0') : '—'
              }
              sub={data.hottestPowerball ? `Drawn ${data.hottestPowerball.count} times` : undefined}
            />
          </>
        )}
      </div>

      {/* Prediction performance, not feed statistics — unaffected by the window
          filter above, which only narrows the draw analysis. */}
      <StrategyPerformanceTable />

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <FrequencyChart
          title="White ball frequency"
          description={`How often each of the 69 white balls was drawn across ${data.analysed.toLocaleString()} draws.`}
          data={data.whiteFrequency}
          tickInterval={4}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isPending ? (
          <>
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </>
        ) : (
          <>
            <FrequencyChart
              title="Powerball frequency"
              description="The Powerball is drawn from its own 1–26 pool, independent of the white balls."
              data={data.powerballFrequency}
              tickInterval={1}
            />
            <DistributionChart
              title="Sum distribution"
              description={`Total of the five white balls. The average across this window is ${data.averageSum}.`}
              data={data.sumBuckets}
              unitLabel="Sum range"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isPending ? (
          <>
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </>
        ) : (
          <>
            <DistributionChart
              title="Odd / even split"
              description="How many of the five white balls were odd."
              data={data.oddEvenSplit}
              unitLabel="Split"
            />
            <DistributionChart
              title="High / low split"
              description="Balls above 35 versus 35 and below."
              data={data.highLowSplit}
              unitLabel="Split"
            />
          </>
        )}
      </div>
    </div>
  );
}
