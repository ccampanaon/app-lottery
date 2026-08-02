import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { Draw } from '@/types';

/** Builds newest-first draws, one day apart, exactly as the feed serves them. */
function makeDraws(rows: { numbers: number[]; powerball: number }[]): Draw[] {
  return rows.map((row, i) => ({
    drawDate: new Date(Date.UTC(2026, 6, 22 - i)).toISOString(),
    numbers: [...row.numbers].sort((a, b) => a - b),
    powerball: row.powerball,
    multiplier: null,
  }));
}

const draws = makeDraws([
  { numbers: [1, 2, 3, 4, 5], powerball: 7 }, // newest
  { numbers: [1, 2, 3, 4, 6], powerball: 7 },
  { numbers: [1, 2, 3, 60, 61], powerball: 9 },
]);

describe('computeStats', () => {
  it('counts every appearance across the analysed draws', () => {
    const stats = computeStats(draws);
    const freq = (n: number) => stats.whiteFrequency.find((f) => f.number === n)!;

    expect(freq(1).count).toBe(3);
    expect(freq(4).count).toBe(2);
    expect(freq(5).count).toBe(1);
    expect(freq(69).count).toBe(0);
  });

  it('returns an entry for all 69 white balls and all 26 Powerballs', () => {
    const stats = computeStats(draws);
    expect(stats.whiteFrequency).toHaveLength(69);
    expect(stats.powerballFrequency).toHaveLength(26);
  });

  it('measures the gap as draws since the number last appeared', () => {
    const stats = computeStats(draws);
    const freq = (n: number) => stats.whiteFrequency.find((f) => f.number === n)!;

    expect(freq(1).gap).toBe(0); // in the newest draw
    expect(freq(6).gap).toBe(1); // one draw ago
    expect(freq(60).gap).toBe(2); // two draws ago
    expect(freq(69).gap).toBeNull(); // never drawn
  });

  it('picks the hottest number, breaking ties by lowest value', () => {
    const stats = computeStats(draws);
    // 1, 2 and 3 all appear 3 times; the lowest wins the tie.
    expect(stats.hottestWhite).toMatchObject({ number: 1, count: 3 });
  });

  it('treats a never-drawn number as the most overdue', () => {
    const stats = computeStats(draws);
    expect(stats.mostOverdueWhite?.gap).toBeNull();
  });

  it('counts the Powerball pool separately from the white balls', () => {
    const stats = computeStats(draws);
    expect(stats.hottestPowerball).toMatchObject({ number: 7, count: 2 });
    // 7 appears twice as a Powerball but never as a white ball.
    expect(stats.whiteFrequency.find((f) => f.number === 7)!.count).toBe(0);
  });

  it('honours the analysis window and still reports the full total', () => {
    const stats = computeStats(draws, 2);
    expect(stats.totalDraws).toBe(3);
    expect(stats.analysed).toBe(2);
    // 60 only appears in the third draw, which the window excludes.
    expect(stats.whiteFrequency.find((f) => f.number === 60)!.count).toBe(0);
  });

  it('reports the latest draw as the first of the newest-first list', () => {
    const stats = computeStats(draws);
    expect(stats.latest?.numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('averages the five-ball sum', () => {
    // 15, 16 and 127 -> 158/3 -> 53 rounded.
    expect(computeStats(draws).averageSum).toBe(53);
  });

  it('buckets sums into labelled ranges that total the draw count', () => {
    const stats = computeStats(draws);
    expect(stats.sumBuckets.reduce((t, b) => t + b.count, 0)).toBe(3);
  });

  it('splits odd/even across six buckets that total the draw count', () => {
    const stats = computeStats(draws);
    expect(stats.oddEvenSplit).toHaveLength(6);
    expect(stats.oddEvenSplit.reduce((t, b) => t + b.count, 0)).toBe(3);
    // [1,2,3,4,5] has three odd numbers.
    expect(stats.oddEvenSplit[3].count).toBeGreaterThanOrEqual(1);
  });

  it('handles an empty history without dividing by zero', () => {
    const stats = computeStats([]);
    expect(stats.totalDraws).toBe(0);
    expect(stats.averageSum).toBe(0);
    expect(stats.latest).toBeNull();
    expect(stats.whiteFrequency.every((f) => f.count === 0 && f.gap === null)).toBe(true);
  });
});
