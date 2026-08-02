import type { Draw } from '@/types';

/**
 * Official draw numbers, derived — the NY open-data feed does not carry them.
 * Its only columns are draw_date, winning_numbers, multiplier and
 * double_play_winning_numbers.
 *
 * Powerball numbers its draws consecutively across the game's whole history, so
 * a number can be recovered by counting feed entries away from a known anchor.
 * Verified against the official results table: counting back from #1644 gives
 * #1643, #1642, #1641 and #1640 for the four preceding draws, all matching.
 */
export const DRAW_NUMBER_ANCHOR = { date: '2026-07-22', number: 1644 } as const;

/**
 * Counting is only valid while the feed is contiguous. Auditing it against the
 * published Mon/Wed/Sat schedule turns up five absent draws:
 *
 *   2017-06-10 · 2021-04-28 · 2022-03-12 · 2022-04-09 · 2022-11-07
 *
 * Every gap shifts the count for draws older than it, so numbering is reported
 * only for draws after the most recent one. Older draws get `null` rather than a
 * number that would be quietly wrong.
 */
export const FEED_GAPS = [
  '2017-06-10',
  '2021-04-28',
  '2022-03-12',
  '2022-04-09',
  '2022-11-07',
] as const;

export const LAST_FEED_GAP = FEED_GAPS[FEED_GAPS.length - 1];

/**
 * Draw number for each draw in the feed, keyed by `YYYY-MM-DD`.
 *
 * @param draws newest-first, as the feed serves them
 */
export function buildDrawNumbers(draws: Draw[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const anchorIndex = draws.findIndex((d) => d.drawDate.slice(0, 10) === DRAW_NUMBER_ANCHOR.date);

  // Without the anchor in view there is nothing to count from.
  if (anchorIndex === -1) return numbers;

  draws.forEach((draw, index) => {
    const key = draw.drawDate.slice(0, 10);
    if (key <= LAST_FEED_GAP) return;

    // Newest-first: a smaller index is a later draw, so a higher number.
    numbers.set(key, DRAW_NUMBER_ANCHOR.number + (anchorIndex - index));
  });

  return numbers;
}

/** Draw number for one date, or null when it cannot be derived reliably. */
export function drawNumberFor(dateKey: string, drawNumbers: Map<string, number>): number | null {
  return drawNumbers.get(dateKey) ?? null;
}
