/*
 * Chart constants shared by every dashboard chart, so the specs are applied once
 * rather than re-typed per component.
 *
 * The sequential ramp is validated against the card surface (#121a2e):
 * monotone lightness, adjacent gaps >= 0.06, darkest step 2.14:1 vs surface,
 * hue spread 4 degrees. Adding intermediate steps breaks the adjacent gate.
 */
export const SEQUENTIAL_RAMP = [
  '#184f95',
  '#256abf',
  '#3987e5',
  '#6da7ec',
  '#9ec5f4',
  '#cde2fb',
] as const;

export const SERIES_COLOR = '#3987e5';
export const GRID_COLOR = '#1e293b';
export const AXIS_COLOR = '#334155';
export const MUTED_INK = '#94a3b8';

/** Bars cap at 24px so the band keeps its air; ends round 4px, square at the baseline. */
export const MAX_BAR_SIZE = 24;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** 2px of surface between touching bars does the separating — never a stroke. */
export const BAR_CATEGORY_GAP = 2;

export const AXIS_TICK = { fill: MUTED_INK, fontSize: 11 } as const;

/**
 * Map a value onto the ramp. Darkest = lowest, lightest = highest, so "more is
 * lighter" against a dark surface — the same more-is-more-contrast reading a
 * light-surface chart gets from more-is-darker.
 */
export function rampStep(value: number, min: number, max: number): string {
  if (max <= min) return SEQUENTIAL_RAMP[Math.floor(SEQUENTIAL_RAMP.length / 2)];
  const ratio = (value - min) / (max - min);
  const index = Math.min(SEQUENTIAL_RAMP.length - 1, Math.floor(ratio * SEQUENTIAL_RAMP.length));
  return SEQUENTIAL_RAMP[index];
}
