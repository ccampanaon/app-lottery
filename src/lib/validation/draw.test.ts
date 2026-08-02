import { describe, expect, it } from 'vitest';
import { normalizeDrawDate } from '@/lib/constants';
import { feedRowSchema } from './draw';

const validRow = {
  drawDate: '2026-07-22T00:00:00.000Z',
  numbers: [4, 5, 22, 50, 58],
  powerball: 1,
  multiplier: 3,
};

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('feedRowSchema', () => {
  it('accepts a well-formed feed row', () => {
    expect(feedRowSchema.safeParse(validRow).success).toBe(true);
  });

  it('sorts the white balls ascending', () => {
    const result = feedRowSchema.parse({ ...validRow, numbers: [58, 4, 50, 22, 5] });
    expect(result.numbers).toEqual([4, 5, 22, 50, 58]);
  });

  it('pins the draw date to UTC midnight', () => {
    const result = feedRowSchema.parse({ ...validRow, drawDate: '2026-07-22T18:45:12.000Z' });
    expect(result.drawDate).toBe('2026-07-22T00:00:00.000Z');
  });

  it('defaults an absent multiplier to null rather than undefined', () => {
    const { drawDate, numbers, powerball } = validRow;
    expect(feedRowSchema.parse({ drawDate, numbers, powerball }).multiplier).toBeNull();
  });

  it('rejects duplicate white balls', () => {
    const result = feedRowSchema.safeParse({ ...validRow, numbers: [4, 4, 22, 50, 58] });
    expect(result.success).toBe(false);
    expect(firstError(result)).toMatch(/different/i);
  });

  it.each([
    ['below the range', [0, 5, 22, 50, 58]],
    ['above the range', [4, 5, 22, 50, 70]],
    ['non-integer', [4.5, 5, 22, 50, 58]],
  ])('rejects a white ball %s', (_label, numbers) => {
    expect(feedRowSchema.safeParse({ ...validRow, numbers }).success).toBe(false);
  });

  it.each([
    ['too few', [4, 5, 22, 50]],
    ['too many', [4, 5, 22, 50, 58, 61]],
  ])('rejects %s white balls', (_label, numbers) => {
    expect(feedRowSchema.safeParse({ ...validRow, numbers }).success).toBe(false);
  });

  it.each([0, 27, 2.5])('rejects powerball %s', (powerball) => {
    expect(feedRowSchema.safeParse({ ...validRow, powerball }).success).toBe(false);
  });

  it('accepts the powerball repeating a white ball value', () => {
    // Separate pools — 4 can legitimately appear as both.
    expect(feedRowSchema.safeParse({ ...validRow, powerball: 4 }).success).toBe(true);
  });

  it('rejects rows from before the 69/26 matrix', () => {
    const result = feedRowSchema.safeParse({ ...validRow, drawDate: '2015-10-06T00:00:00Z' });
    expect(result.success).toBe(false);
    expect(firstError(result)).toMatch(/matrix/i);
  });

  it('accepts the first draw of the 69/26 matrix', () => {
    expect(feedRowSchema.safeParse({ ...validRow, drawDate: '2015-10-07T00:00:00Z' }).success).toBe(
      true,
    );
  });

  it('rejects a nonsense date string', () => {
    expect(feedRowSchema.safeParse({ ...validRow, drawDate: 'not-a-date' }).success).toBe(false);
  });
});

describe('normalizeDrawDate', () => {
  it('is idempotent', () => {
    const once = normalizeDrawDate(new Date('2026-07-22T18:45:12.000Z'));
    expect(normalizeDrawDate(once).toISOString()).toBe(once.toISOString());
  });

  it('keeps the UTC calendar date regardless of the time of day', () => {
    expect(normalizeDrawDate(new Date('2026-07-22T23:59:59.999Z')).toISOString()).toBe(
      '2026-07-22T00:00:00.000Z',
    );
  });
});
