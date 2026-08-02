import { WHITE_BALL_MAX } from '@/lib/constants';
import type { Draw } from '@/types';

/** Sum of the five white balls. Most draws land between 120 and 190. */
export function drawSum(draw: Draw): number {
  return draw.numbers.reduce((total, n) => total + n, 0);
}

export function oddCount(draw: Draw): number {
  return draw.numbers.filter((n) => n % 2 === 1).length;
}

/** Balls in the upper half of the 1–69 pool. */
export function highCount(draw: Draw): number {
  const midpoint = Math.ceil(WHITE_BALL_MAX / 2);
  return draw.numbers.filter((n) => n > midpoint).length;
}

/** Runs of consecutive values, e.g. [14,15] in 3-14-15-40-52. */
export function consecutivePairs(numbers: number[]): number {
  let count = 0;
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] === numbers[i - 1] + 1) count += 1;
  }
  return count;
}

/** `2026-07-22T00:00:00.000Z` → `Wed 22 Jul 2026`, always read in UTC. */
export function formatDrawDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `2026-07-22T00:00:00.000Z` → `2026-07-22`, for date inputs. */
export function toDayKey(iso: string): string {
  return iso.slice(0, 10);
}
