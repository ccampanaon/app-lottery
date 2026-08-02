import { describe, expect, it } from 'vitest';
import {
  consecutivePairs,
  drawSum,
  formatDrawDate,
  highCount,
  oddCount,
  toDayKey,
} from './draw-utils';
import type { Draw } from '@/types';

const draw = (numbers: number[], powerball = 1): Draw => ({
  drawDate: '2026-07-22T00:00:00.000Z',
  numbers,
  powerball,
  multiplier: null,
});

describe('drawSum', () => {
  it('adds the five white balls only, excluding the Powerball', () => {
    expect(drawSum(draw([1, 2, 3, 4, 5], 26))).toBe(15);
  });
});

describe('oddCount', () => {
  it.each([
    [[1, 3, 5, 7, 9], 5],
    [[2, 4, 6, 8, 10], 0],
    [[1, 2, 3, 4, 5], 3],
  ])('%s -> %i odd', (numbers, expected) => {
    expect(oddCount(draw(numbers))).toBe(expected);
  });
});

describe('highCount', () => {
  it('splits the 1-69 pool at 35', () => {
    // Midpoint is ceil(69/2) = 35, so "high" means 36 and above.
    expect(highCount(draw([34, 35, 36, 37, 38]))).toBe(3);
  });

  it('counts none when every ball is in the lower half', () => {
    expect(highCount(draw([1, 2, 3, 4, 5]))).toBe(0);
  });

  it('counts all when every ball is in the upper half', () => {
    expect(highCount(draw([65, 66, 67, 68, 69]))).toBe(5);
  });
});

describe('consecutivePairs', () => {
  it.each([
    [[3, 14, 15, 40, 52], 1],
    [[1, 2, 3, 40, 52], 2],
    [[1, 2, 3, 4, 5], 4],
    [[2, 10, 20, 30, 40], 0],
  ])('%s -> %i pairs', (numbers, expected) => {
    expect(consecutivePairs(numbers)).toBe(expected);
  });
});

describe('formatDrawDate', () => {
  it('reads the date in UTC, not the machine timezone', () => {
    // Late-evening UTC would roll back a day in any negative-offset zone if the
    // formatter used local time.
    expect(formatDrawDate('2026-07-22T23:30:00.000Z')).toContain('22 Jul 2026');
  });

  it('includes the weekday', () => {
    expect(formatDrawDate('2026-07-22T00:00:00.000Z')).toContain('Wed');
  });
});

describe('toDayKey', () => {
  it('extracts the calendar date', () => {
    expect(toDayKey('2026-07-22T00:00:00.000Z')).toBe('2026-07-22');
  });
});
