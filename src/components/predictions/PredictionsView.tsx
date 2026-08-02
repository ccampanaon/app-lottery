'use client';

import { CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DisclaimerBanner } from './DisclaimerBanner';
import { SavedPredictions } from './SavedPredictions';
import { StrategyGroup } from './StrategyGroup';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentPrediction, useGeneratePrediction } from '@/hooks/usePredictions';
import { MAX_PREDICTION_SETS } from '@/lib/constants';
import { formatDrawDate } from '@/lib/draw-utils';

const WINDOWS = [
  { label: 'Last 50', value: 50 },
  { label: 'Last 100', value: 100 },
  { label: 'Last 250', value: 250 },
  { label: 'All draws', value: undefined },
];

export function PredictionsView() {
  const [count, setCount] = useState(5);
  const [window, setWindow] = useState<number | undefined>(undefined);

  const current = useCurrentPrediction();
  const generate = useGeneratePrediction();

  const alreadyGenerated = current.data?.generated ?? false;

  return (
    <div className="space-y-6">
      <DisclaimerBanner />

      <section className="border-border bg-card space-y-4 rounded-lg border p-4 sm:p-5">
        {current.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : current.isError ? (
          <ErrorState
            message={
              current.error instanceof Error ? current.error.message : 'Could not load predictions'
            }
            onRetry={() => current.refetch()}
          />
        ) : alreadyGenerated ? (
          /*
           * Already generated for this draw: the controls are gone rather than
           * disabled, because changing them would imply a regeneration that is
           * not on offer. One draw gets one set of numbers.
           */
          <div className="flex flex-wrap items-start gap-3">
            <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">
                Numbers are already generated for the draw of{' '}
                {formatDrawDate(current.data.targetDrawDate)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {current.data.predictions.length} strategies were saved
                {current.data.analysisWindow
                  ? `, analysing the last ${current.data.analysisWindow} draws`
                  : ', analysing the full history'}
                . Generating again is available once this draw has been published and the next one
                becomes the target — or immediately, if you delete these below.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="count" className="block text-sm font-medium">
                  Number of sets
                </label>
                <select
                  id="count"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="bg-input border-border h-10 w-full rounded-md border px-3 text-sm"
                >
                  {Array.from({ length: MAX_PREDICTION_SETS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} set{n === 1 ? '' : 's'} per strategy
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="window" className="block text-sm font-medium">
                  Analysis window
                </label>
                <select
                  id="window"
                  value={window ?? 'all'}
                  onChange={(e) =>
                    setWindow(e.target.value === 'all' ? undefined : Number(e.target.value))
                  }
                  className="bg-input border-border h-10 w-full rounded-md border px-3 text-sm"
                >
                  {WINDOWS.map((option) => (
                    <option key={option.label} value={option.value ?? 'all'}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={() => generate.mutate({ sets: count, window })}
              loading={generate.isPending}
            >
              <Sparkles className="size-4" aria-hidden />
              Generate for {formatDrawDate(current.data.targetDrawDate)}
            </Button>

            <p className="text-muted-foreground text-xs">
              Every strategy runs against the same draws and all results are saved automatically.
              This can only be done once per draw.
            </p>
          </>
        )}
      </section>

      {current.data && current.data.predictions.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Numbers for the draw of {formatDrawDate(current.data.targetDrawDate)}
            </h2>
            <p className="text-muted-foreground text-xs">
              {current.data.predictions.length} strategies ·{' '}
              {current.data.drawsAnalysed.toLocaleString()} draws analysed
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {current.data.predictions.map((prediction) => (
              <StrategyGroup key={prediction.id} prediction={prediction} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">History</h2>
        <SavedPredictions />
      </section>
    </div>
  );
}
