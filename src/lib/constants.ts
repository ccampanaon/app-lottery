/** White balls are drawn from a single pool of 1–69, five at a time, without replacement. */
export const WHITE_BALL_MIN = 1;
export const WHITE_BALL_MAX = 69;
export const WHITE_BALL_COUNT = 5;

/** The Powerball is drawn from a separate 1–26 pool, so it may repeat a white ball's value. */
export const POWERBALL_MIN = 1;
export const POWERBALL_MAX = 26;

/** Power Play multiplier, when recorded. 10× only appears on jackpots under $150M. */
export const MULTIPLIER_MIN = 2;
export const MULTIPLIER_MAX = 10;

/**
 * The 69/26 matrix took effect with the 2015-10-07 draw. Earlier draws used
 * 59/35, so mixing them would corrupt every frequency statistic in the app.
 */
export const MATRIX_START_DATE = new Date(Date.UTC(2015, 9, 7));

/** Official draw days (UTC day-of-week): Monday, Wednesday, Saturday. */
export const DRAW_WEEKDAYS = [1, 3, 6] as const;

/** A saved prediction holds at most this many playable lines. */
export const MAX_PREDICTION_SETS = 10;

export const PREDICTION_STRATEGIES = [
  'frequency',
  'overdue',
  'weighted-random',
  'pairs',
  'markov',
  'balanced-shape',
  'neural',
  'ensemble',
] as const;

export const STRATEGY_LABELS: Record<(typeof PREDICTION_STRATEGIES)[number], string> = {
  frequency: 'Hot numbers',
  overdue: 'Cold / overdue',
  'weighted-random': 'Weighted random',
  pairs: 'Frequent pairs',
  markov: 'Positional Markov',
  'balanced-shape': 'Balanced shape',
  neural: 'Neural net (TensorFlow.js)',
  ensemble: 'Ensemble',
};

export const WHITE_BALL_RANGE = Array.from(
  { length: WHITE_BALL_MAX - WHITE_BALL_MIN + 1 },
  (_, i) => i + WHITE_BALL_MIN,
);

export const POWERBALL_RANGE = Array.from(
  { length: POWERBALL_MAX - POWERBALL_MIN + 1 },
  (_, i) => i + POWERBALL_MIN,
);

/**
 * Collapse a date to UTC midnight. Draw dates are calendar dates, not instants —
 * normalising on write is what makes the unique index on `drawDate` meaningful
 * and the history import idempotent.
 */
export function normalizeDrawDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
