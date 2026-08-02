import { describe, expect, it } from 'vitest';
import { MAX_PREDICTION_SETS } from '@/lib/constants';
import { generateQuerySchema, predictionInputSchema } from './prediction';

const set = (numbers: number[], powerball: number) => ({
  numbers,
  powerball,
  strategy: 'frequency' as const,
});

const validPrediction = {
  targetDrawDate: '2026-07-25T00:00:00.000Z',
  sets: [set([4, 12, 27, 41, 63], 9)],
};

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('predictionInputSchema', () => {
  it('accepts a single-set prediction', () => {
    expect(predictionInputSchema.safeParse(validPrediction).success).toBe(true);
  });

  it(`accepts exactly ${MAX_PREDICTION_SETS} sets`, () => {
    const sets = Array.from({ length: MAX_PREDICTION_SETS }, (_, i) =>
      set([1 + i, 12, 27, 41, 63], 9),
    );
    expect(predictionInputSchema.safeParse({ ...validPrediction, sets }).success).toBe(true);
  });

  it(`rejects more than ${MAX_PREDICTION_SETS} sets`, () => {
    const sets = Array.from({ length: MAX_PREDICTION_SETS + 1 }, (_, i) =>
      set([1 + i, 12, 27, 41, 63], 9),
    );
    const result = predictionInputSchema.safeParse({ ...validPrediction, sets });
    expect(result.success).toBe(false);
    expect(firstError(result)).toMatch(/at most 10 sets/i);
  });

  it('rejects an empty set list', () => {
    const result = predictionInputSchema.safeParse({ ...validPrediction, sets: [] });
    expect(result.success).toBe(false);
    expect(firstError(result)).toMatch(/at least one set/i);
  });

  it('sorts the numbers within each set', () => {
    const result = predictionInputSchema.parse({
      ...validPrediction,
      sets: [set([63, 4, 41, 12, 27], 9)],
    });
    expect(result.sets[0].numbers).toEqual([4, 12, 27, 41, 63]);
  });

  it('pins the target draw date to UTC midnight', () => {
    const result = predictionInputSchema.parse({
      ...validPrediction,
      targetDrawDate: '2026-07-25T22:59:00.000Z',
    });
    expect(result.targetDrawDate).toBe('2026-07-25T00:00:00.000Z');
  });

  it('applies the white-ball rules to every set, not just the first', () => {
    const result = predictionInputSchema.safeParse({
      ...validPrediction,
      sets: [set([4, 12, 27, 41, 63], 9), set([4, 4, 27, 41, 63], 9)],
    });
    expect(result.success).toBe(false);
    expect(firstError(result)).toMatch(/different/i);
  });

  it('rejects an out-of-range powerball in a later set', () => {
    const result = predictionInputSchema.safeParse({
      ...validPrediction,
      sets: [set([4, 12, 27, 41, 63], 9), set([2, 14, 29, 43, 65], 27)],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown strategy', () => {
    const result = predictionInputSchema.safeParse({
      ...validPrediction,
      sets: [{ numbers: [4, 12, 27, 41, 63], powerball: 9, strategy: 'astrology' }],
    });
    expect(result.success).toBe(false);
  });

  it('allows a target date in the future — that is the entire point', () => {
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      predictionInputSchema.safeParse({ ...validPrediction, targetDrawDate: nextYear }).success,
    ).toBe(true);
  });
});

describe('generateQuerySchema', () => {
  it('leaves strategy undefined by default, which means "run them all"', () => {
    const result = generateQuerySchema.parse({});
    expect(result).toEqual({ sets: 5 });
    expect(result.strategy).toBeUndefined();
  });

  it('still accepts a single named strategy', () => {
    expect(generateQuerySchema.parse({ strategy: 'pairs' }).strategy).toBe('pairs');
  });

  it('coerces string query params', () => {
    const result = generateQuerySchema.parse({ strategy: 'overdue', sets: '3', window: '100' });
    expect(result).toEqual({ strategy: 'overdue', sets: 3, window: 100 });
  });

  it(`caps the requested sets at ${MAX_PREDICTION_SETS}`, () => {
    expect(generateQuerySchema.safeParse({ sets: '11' }).success).toBe(false);
  });

  it('rejects an unknown strategy', () => {
    expect(generateQuerySchema.safeParse({ strategy: 'vibes' }).success).toBe(false);
  });
});
