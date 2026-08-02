'use client';

import { MatchCount, ScoredBallRow, countMatches } from '@/components/draws/NumberBall';
import { STRATEGY_LABELS } from '@/lib/constants';
import { prizeTier } from '@/lib/prediction/score';
import type { PredictionDTO } from '@/types';

/**
 * One saved strategy's numbers for a draw. Once that draw is published each set
 * is scored, so the same card shows the picks before and the result after.
 */
export function StrategyGroup({ prediction }: { prediction: PredictionDTO }) {
  return (
    <section className="border-border bg-card rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{STRATEGY_LABELS[prediction.strategy]}</h3>
        {prediction.outcome && (
          <span
            className={
              prediction.outcome.bestWhiteHits >= 3
                ? 'bg-success/15 text-success rounded-full px-2 py-0.5 text-xs font-medium'
                : 'border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs'
            }
          >
            Best: {prediction.outcome.bestWhiteHits} of 5
          </span>
        )}
      </div>

      <ol className="space-y-2.5">
        {prediction.sets.map((set, i) => {
          const actual = prediction.outcome?.actual ?? null;
          const match = actual ? countMatches(set.numbers, set.powerball, actual) : null;
          const tier = match ? prizeTier(match.whiteHits, match.powerballHit) : null;

          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground tabular w-5 shrink-0 text-xs">{i + 1}.</span>
              <ScoredBallRow numbers={set.numbers} powerball={set.powerball} actual={actual} />
              {match && (
                <MatchCount whiteHits={match.whiteHits} powerballHit={match.powerballHit} />
              )}
              {tier && (
                <span className="bg-success/15 text-success rounded px-1.5 py-0.5 text-xs font-medium">
                  {tier}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* One rationale per strategy — every set in this card shares it. */}
      {prediction.sets[0]?.rationale && (
        <p className="text-muted-foreground border-border/60 mt-3 border-t pt-2.5 text-xs">
          {prediction.sets[0].rationale}
        </p>
      )}
    </section>
  );
}
