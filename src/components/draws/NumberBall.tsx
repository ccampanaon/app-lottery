import type { MatchSummary } from '@/lib/prediction/score';
import { cn } from '@/lib/utils';
import type { Draw } from '@/types';

// Scoring lives in lib/prediction/score.ts — the dashboard aggregation needs it
// server-side, so it cannot sit in a component module.
export { countCoverage, countMatches } from '@/lib/prediction/score';

type BallState = 'default' | 'hit' | 'miss';

type NumberBallProps = {
  value: number;
  variant?: 'white' | 'power';
  size?: 'sm' | 'md' | 'lg';
  /** Scoring state once the draw has happened. */
  state?: BallState;
};

const SIZES = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-11 text-base',
} as const;

/*
 * Hit balls carry dark digits, not white ones: white on the success green
 * measures 2.54:1, below the 4.5:1 minimum, while dark text on it is 7.04:1.
 * It also matches how a white ball already renders — dark digits on a light
 * face — so only the colour changes, not the reading.
 */
const WHITE_STATES: Record<BallState, string> = {
  default: 'bg-ball text-ball-foreground',
  hit: 'bg-success text-ball-foreground ring-success/40 ring-2',
  // Misses recede so the hits carry the eye, without disappearing.
  miss: 'bg-ball/25 text-muted-foreground',
};

const POWER_STATES: Record<BallState, string> = {
  default: 'bg-primary text-primary-foreground ring-primary/30 ring-2',
  hit: 'bg-success text-ball-foreground ring-success/40 ring-2',
  miss: 'bg-primary/25 text-muted-foreground',
};

/**
 * A single drawn number. White balls and the Powerball are visually distinct
 * because they come from separate pools — the same value can appear as both.
 */
export function NumberBall({
  value,
  variant = 'white',
  size = 'md',
  state = 'default',
}: NumberBallProps) {
  return (
    <span
      className={cn(
        'tabular inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        variant === 'white' ? WHITE_STATES[state] : POWER_STATES[state],
      )}
    >
      {/* Zero-padded so 5 and 15 occupy the same width in a column of balls. */}
      {String(value).padStart(2, '0')}
    </span>
  );
}

/** A full line: five white balls then the Powerball. */
export function BallRow({
  numbers,
  powerball,
  size = 'md',
}: {
  numbers: number[];
  powerball: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="flex items-center gap-1.5">
      {numbers.map((n, i) => (
        <NumberBall key={`${n}-${i}`} value={n} size={size} />
      ))}
      <span className="text-muted-foreground/40 px-0.5 select-none" aria-hidden>
        |
      </span>
      <NumberBall value={powerball} variant="power" size={size} />
    </div>
  );
}

/**
 * A played line rendered against the result: matches highlighted, misses
 * receded. Falls back to a plain row while the draw is still pending.
 */
export function ScoredBallRow({
  numbers,
  powerball,
  actual,
  size = 'sm',
}: {
  numbers: number[];
  powerball: number;
  actual: Draw | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!actual) return <BallRow numbers={numbers} powerball={powerball} size={size} />;

  const drawn = new Set(actual.numbers);
  const powerballHit = powerball === actual.powerball;

  return (
    <div className="flex items-center gap-1.5">
      {numbers.map((n, i) => (
        <NumberBall key={`${n}-${i}`} value={n} size={size} state={drawn.has(n) ? 'hit' : 'miss'} />
      ))}
      <span className="text-muted-foreground/40 px-0.5 select-none" aria-hidden>
        |
      </span>
      <NumberBall
        value={powerball}
        variant="power"
        size={size}
        state={powerballHit ? 'hit' : 'miss'}
      />
    </div>
  );
}

/** Compact "2 of 5 + PB" label used beside a scored line or a strategy. */
export function MatchCount({
  whiteHits,
  powerballHit,
  suffix,
  className,
}: MatchSummary & { suffix?: string; className?: string }) {
  const scored = whiteHits > 0 || powerballHit;

  return (
    <span
      className={cn(
        'tabular rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        scored ? 'bg-success/15 text-success' : 'border-border text-muted-foreground border',
        className,
      )}
    >
      {whiteHits} of 5{powerballHit && ' + PB'}
      {suffix && <span className="ml-1 font-normal opacity-80">{suffix}</span>}
    </span>
  );
}
