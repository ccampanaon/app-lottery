'use client';

import { MinusCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  BallRow,
  MatchCount,
  ScoredBallRow,
  countCoverage,
  countMatches,
} from '@/components/draws/NumberBall';
import { Button } from '@/components/ui/Button';
import { STRATEGY_LABELS } from '@/lib/constants';
import { formatDrawDate } from '@/lib/draw-utils';
import { prizeTier } from '@/lib/prediction/score';
import { cn } from '@/lib/utils';
import type { DrawHistoryEntry } from '@/types';

/**
 * One row per draw, expanding to reveal every strategy predicted for it.
 *
 * Collapsed it mirrors the official results table — date, draw number, winning
 * numbers, Powerball — so the published result and your picks read the same way.
 */
export function DrawHistoryRow({
  entry,
  onDelete,
  deletingId,
}: {
  entry: DrawHistoryEntry;
  onDelete: (id: string) => void;
  deletingId?: string;
}) {
  const [open, setOpen] = useState(false);
  const { actual } = entry;

  /*
   * Per-strategy coverage: the distinct winning numbers each strategy found
   * across all of its sets.
   */
  const coverageByStrategy = actual
    ? entry.predictions.map((p) => countCoverage(p.sets, actual))
    : [];

  /*
   * The row summarises with the best *strategy's* coverage, not a union across
   * all of them. Pooling seven strategies covers nearly the whole winning line
   * every time, so the row would read "5 of 5" on an ordinary draw and look
   * like a jackpot.
   */
  const bestCoverage = coverageByStrategy.reduce(
    (best, c) => (c.whiteHits > best.whiteHits ? c : best),
    { whiteHits: 0, powerballHit: false },
  );
  const anyPowerballHit = coverageByStrategy.some((c) => c.powerballHit);

  /*
   * Pooled across every strategy's sets, shown separately from `bestCoverage`
   * so it never reads as what a single ticket actually won — see the comment
   * above. With 7 strategies x 5 sets in play, this number runs high on
   * nearly every draw by breadth alone.
   */
  const pooledCoverage = actual
    ? countCoverage(
        entry.predictions.flatMap((p) => p.sets),
        actual,
      )
    : null;

  return (
    <div className="border-border border-b last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:gap-4',
          open && 'bg-muted/30',
        )}
      >
        <span className="w-28 shrink-0 text-sm font-medium whitespace-nowrap">
          {formatDrawDate(entry.targetDrawDate)}
        </span>

        <span className="text-muted-foreground tabular hidden w-20 shrink-0 text-sm sm:block">
          {entry.drawNumber ? `#${entry.drawNumber}` : '—'}
        </span>

        <span className="hidden min-w-0 flex-1 sm:block">
          {actual ? (
            <BallRow numbers={actual.numbers} powerball={actual.powerball} size="sm" />
          ) : (
            <span className="text-muted-foreground text-sm">Awaiting draw</span>
          )}
        </span>

        {/* Match count stays visible at every breakpoint — it is the one number
            worth seeing without expanding the row. */}
        <span className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5 sm:ml-0">
          {actual && pooledCoverage ? (
            <>
              <MatchCount
                whiteHits={bestCoverage.whiteHits}
                powerballHit={anyPowerballHit}
                suffix="best"
              />
              <MatchCount
                whiteHits={pooledCoverage.whiteHits}
                powerballHit={pooledCoverage.powerballHit}
                suffix="pooled"
                className="opacity-70"
              />
            </>
          ) : (
            <span className="text-muted-foreground text-xs">
              {entry.predictions.length} strateg{entry.predictions.length === 1 ? 'y' : 'ies'}
            </span>
          )}
        </span>

        {open ? (
          <MinusCircle className="text-muted-foreground size-5 shrink-0" aria-hidden />
        ) : (
          <PlusCircle className="text-muted-foreground size-5 shrink-0" aria-hidden />
        )}
      </button>

      {open && (
        <div className="bg-background/40 px-4 pt-1 pb-5 sm:px-8">
          {/* The winning line is hidden in the collapsed row on small screens,
              so repeat it here where there is room. */}
          {actual && (
            <div className="mb-3 sm:hidden">
              <p className="text-muted-foreground mb-1.5 text-xs">Winning numbers</p>
              <BallRow numbers={actual.numbers} powerball={actual.powerball} size="sm" />
            </div>
          )}

          <p className="text-muted-foreground mb-3 text-xs">
            {entry.predictions.length} strateg{entry.predictions.length === 1 ? 'y' : 'ies'} ·{' '}
            {entry.totalSets} set{entry.totalSets === 1 ? '' : 's'}
            {entry.predictions[0]?.analysisWindow
              ? ` · last ${entry.predictions[0].analysisWindow} draws analysed`
              : ' · full history analysed'}
            {actual && (
              <>
                {' · '}
                <span className="italic">
                  &ldquo;covered&rdquo; counts distinct winning numbers across a strategy&rsquo;s
                  sets, &ldquo;pooled&rdquo; across every strategy&rsquo;s; only a single line wins
                  a prize
                </span>
              </>
            )}
          </p>

          <div className="grid gap-3 lg:grid-cols-2">
            {entry.predictions.map((prediction, strategyIndex) => {
              // Distinct winning numbers this strategy found across all its sets.
              const coverage = coverageByStrategy[strategyIndex];

              return (
                <div key={prediction.id} className="border-border bg-card rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{STRATEGY_LABELS[prediction.strategy]}</h4>

                    <div className="flex items-center gap-1.5">
                      {actual && coverage && (
                        <MatchCount
                          whiteHits={coverage.whiteHits}
                          powerballHit={coverage.powerballHit}
                          suffix="covered"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${STRATEGY_LABELS[prediction.strategy]} prediction`}
                        loading={deletingId === prediction.id}
                        onClick={() => onDelete(prediction.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {prediction.sets.map((set, i) => {
                      const match = actual
                        ? countMatches(set.numbers, set.powerball, actual)
                        : null;
                      const tier = match ? prizeTier(match.whiteHits, match.powerballHit) : null;

                      return (
                        <li key={i} className="flex flex-wrap items-center gap-2">
                          <ScoredBallRow
                            numbers={set.numbers}
                            powerball={set.powerball}
                            actual={actual}
                          />
                          {match && (
                            <MatchCount
                              whiteHits={match.whiteHits}
                              powerballHit={match.powerballHit}
                            />
                          )}
                          {tier && (
                            <span className="bg-success/15 text-success rounded px-1.5 py-0.5 text-xs font-medium">
                              {tier}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
