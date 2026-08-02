import { describe, expect, it } from 'vitest';
import { DRAW_NUMBER_ANCHOR, LAST_FEED_GAP, buildDrawNumbers } from './draw-number';
import type { Draw } from '@/types';

const draw = (date: string): Draw => ({
  drawDate: `${date}T00:00:00.000Z`,
  numbers: [1, 2, 3, 4, 5],
  powerball: 6,
  multiplier: null,
});

/** Newest-first, matching the feed's ordering. */
const feed = [
  draw('2026-07-25'),
  draw('2026-07-22'), // the anchor, #1644
  draw('2026-07-20'),
  draw('2026-07-18'),
  draw('2026-07-15'),
  draw('2026-07-13'),
];

describe('buildDrawNumbers', () => {
  const numbers = buildDrawNumbers(feed);

  it('matches the official numbers for the anchor and the draws before it', () => {
    // Verified against the published results table.
    expect(numbers.get('2026-07-22')).toBe(1644);
    expect(numbers.get('2026-07-20')).toBe(1643);
    expect(numbers.get('2026-07-18')).toBe(1642);
    expect(numbers.get('2026-07-15')).toBe(1641);
    expect(numbers.get('2026-07-13')).toBe(1640);
  });

  it('numbers draws newer than the anchor', () => {
    expect(numbers.get('2026-07-25')).toBe(1645);
  });

  it('returns nothing when the anchor is not in the feed', () => {
    expect(buildDrawNumbers([draw('2030-01-05')]).size).toBe(0);
  });

  it('refuses to number draws at or before the last feed gap', () => {
    // Counting across a gap silently shifts every earlier number, so those
    // draws get no number rather than a wrong one.
    const withOldDraws = [...feed, draw(LAST_FEED_GAP), draw('2022-11-05')];
    const result = buildDrawNumbers(withOldDraws);

    expect(result.has(LAST_FEED_GAP)).toBe(false);
    expect(result.has('2022-11-05')).toBe(false);
    expect(result.has('2026-07-22')).toBe(true);
  });

  it('keeps consecutive draws exactly one apart', () => {
    const ordered = feed.map((d) => numbers.get(d.drawDate.slice(0, 10))!);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i - 1] - ordered[i]).toBe(1);
    }
  });

  it('anchors on a date the feed actually contains', () => {
    expect(feed.some((d) => d.drawDate.startsWith(DRAW_NUMBER_ANCHOR.date))).toBe(true);
  });
});
