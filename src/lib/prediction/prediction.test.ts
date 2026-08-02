import { describe, expect, it } from 'vitest';
import { POWERBALL_MAX, WHITE_BALL_MAX } from '@/lib/constants';
import type { Draw } from '@/types';
import { SYNC_STRATEGIES, createContext, generateAllSync, generateSets } from './index';
import { createRng, sampleWithoutReplacement } from './rng';
import { prizeTier, scorePrediction } from './score';
import { buildCooccurrence } from './strategies';

/** Deterministic pseudo-history: newest-first, valid draws, some numbers hotter. */
function makeHistory(size: number): Draw[] {
  const rng = createRng(99);
  return Array.from({ length: size }, (_, i) => {
    const numbers = new Set<number>();
    // Bias 1-10 so "hot" is measurably different from "cold".
    while (numbers.size < 5) {
      const roll = rng();
      numbers.add(roll < 0.6 ? 1 + Math.floor(rng() * 10) : 1 + Math.floor(rng() * WHITE_BALL_MAX));
    }
    return {
      drawDate: new Date(Date.UTC(2026, 0, 1) - i * 86_400_000).toISOString(),
      numbers: [...numbers].sort((a, b) => a - b),
      powerball: 1 + Math.floor(rng() * POWERBALL_MAX),
      multiplier: null,
    };
  });
}

const history = makeHistory(200);
const STRATEGIES = [
  'frequency',
  'overdue',
  'weighted-random',
  'pairs',
  'markov',
  'ensemble',
] as const;

describe('sampleWithoutReplacement', () => {
  it('returns the requested count, sorted and distinct', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ value: i + 1, weight: i + 1 }));
    const picked = sampleWithoutReplacement(pool, 5, createRng(1));

    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    expect([...picked].sort((a, b) => a - b)).toEqual(picked);
  });

  it('is deterministic for a given seed', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ value: i + 1, weight: i + 1 }));
    expect(sampleWithoutReplacement(pool, 5, createRng(7))).toEqual(
      sampleWithoutReplacement(pool, 5, createRng(7)),
    );
  });

  it('can still pick a zero-weight value', () => {
    // Zero weights are floored, not excluded — otherwise a never-drawn number
    // would be impossible rather than merely unlikely.
    const pool = [
      { value: 1, weight: 0 },
      { value: 2, weight: 0 },
    ];
    expect(sampleWithoutReplacement(pool, 2, createRng(3)).sort()).toEqual([1, 2]);
  });

  it('never returns more values than the pool holds', () => {
    const pool = [{ value: 4, weight: 1 }];
    expect(sampleWithoutReplacement(pool, 5, createRng(1))).toEqual([4]);
  });
});

describe.each(STRATEGIES)('%s strategy', (strategy) => {
  const sets = generateSets(history, { strategy, count: 5, seed: 42 });

  it('produces the requested number of sets', () => {
    expect(sets).toHaveLength(5);
  });

  it('produces sets that would be accepted as a real play', () => {
    for (const set of sets) {
      expect(set.numbers).toHaveLength(5);
      expect(new Set(set.numbers).size).toBe(5);
      expect([...set.numbers].sort((a, b) => a - b)).toEqual(set.numbers);

      for (const n of set.numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(WHITE_BALL_MAX);
        expect(Number.isInteger(n)).toBe(true);
      }

      expect(set.powerball).toBeGreaterThanOrEqual(1);
      expect(set.powerball).toBeLessThanOrEqual(POWERBALL_MAX);
      expect(Number.isInteger(set.powerball)).toBe(true);
    }
  });

  it('tags every set with its strategy and an explanation', () => {
    for (const set of sets) {
      expect(set.strategy).toBe(strategy);
      expect(set.rationale.length).toBeGreaterThan(20);
    }
  });

  it('returns distinct sets', () => {
    const keys = sets.map((s) => `${s.numbers.join('-')}|${s.powerball}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is reproducible for a fixed seed', () => {
    const repeat = generateSets(history, { strategy, count: 5, seed: 42 });
    expect(repeat).toEqual(sets);
  });

  it('produces different output for a different seed', () => {
    const other = generateSets(history, { strategy, count: 5, seed: 4242 });
    expect(other).not.toEqual(sets);
  });

  it('survives a history of a single draw', () => {
    const tiny = generateSets(history.slice(0, 1), { strategy, count: 1, seed: 5 });
    expect(tiny[0].numbers).toHaveLength(5);
  });
});

describe('generateSets', () => {
  it('honours the analysis window', () => {
    const windowed = generateSets(history, {
      strategy: 'frequency',
      count: 3,
      window: 20,
      seed: 1,
    });
    const full = generateSets(history, { strategy: 'frequency', count: 3, seed: 1 });
    expect(windowed).not.toEqual(full);
  });

  it('favours hot numbers over the full pool', () => {
    // The generated history biases 1-10, so the frequency strategy should lean
    // there far more than an unweighted pick would.
    const sets = generateSets(history, { strategy: 'frequency', count: 10, seed: 11 });
    const all = sets.flatMap((s) => s.numbers);
    const inHotRange = all.filter((n) => n <= 10).length;
    expect(inHotRange / all.length).toBeGreaterThan(0.5);
  });

  it('refuses the neural strategy, which is async and lives in ./ml', () => {
    expect(() => generateSets(history, { strategy: 'neural', count: 1 })).toThrow(/asynchronous/i);
  });

  it('stops rather than looping forever when distinct sets run out', () => {
    // One draw of five numbers gives the pairs strategy almost nothing to vary.
    const sets = generateSets(history.slice(0, 1), { strategy: 'pairs', count: 10, seed: 2 });
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.length).toBeLessThanOrEqual(10);
  });
});

describe('generateAllSync', () => {
  const context = createContext(history, undefined, 7);
  const groups = generateAllSync(context, 3);

  it('returns one group per synchronous strategy', () => {
    expect(groups).toHaveLength(SYNC_STRATEGIES.length);
    expect(groups.map((g) => g.strategy)).toEqual([...SYNC_STRATEGIES]);
  });

  it('never includes the neural strategy, which is async', () => {
    expect(groups.some((g) => g.strategy === 'neural')).toBe(false);
  });

  it('gives every group the requested number of playable sets', () => {
    for (const group of groups) {
      expect(group.sets).toHaveLength(3);
      for (const set of group.sets) {
        expect(set.numbers).toHaveLength(5);
        expect(new Set(set.numbers).size).toBe(5);
        expect(set.strategy).toBe(group.strategy);
      }
    }
  });

  it('produces different numbers across strategies', () => {
    // If the shared context were mutated or the rng reset per strategy, groups
    // would collapse toward identical output.
    const firstSets = groups.map((g) => g.sets[0].numbers.join('-'));
    expect(new Set(firstSets).size).toBeGreaterThan(1);
  });
});

describe('createContext', () => {
  it('narrows the draws to the analysis window', () => {
    expect(createContext(history, 20).draws).toHaveLength(20);
    expect(createContext(history).draws).toHaveLength(history.length);
  });

  it('computes the stats over the window, not the full history', () => {
    expect(createContext(history, 20).stats.analysed).toBe(20);
  });

  it('memoises the co-occurrence matrix', () => {
    const context = createContext(history, 50);
    expect(context.cooccurrence()).toBe(context.cooccurrence());
  });
});

describe('buildCooccurrence', () => {
  it('counts each unordered pair from both directions', () => {
    const matrix = buildCooccurrence([{ numbers: [1, 2, 3] }, { numbers: [1, 2, 9] }]);
    expect(matrix.get(1)?.get(2)).toBe(2);
    expect(matrix.get(2)?.get(1)).toBe(2);
    expect(matrix.get(1)?.get(3)).toBe(1);
    expect(matrix.get(3)?.get(9)).toBeUndefined();
  });

  it('never records a number as co-occurring with itself', () => {
    const matrix = buildCooccurrence([{ numbers: [5, 6] }]);
    expect(matrix.get(5)?.get(5)).toBeUndefined();
  });
});

describe('scorePrediction', () => {
  const actual: Draw = {
    drawDate: '2026-07-25T00:00:00.000Z',
    numbers: [4, 12, 27, 41, 63],
    powerball: 9,
    multiplier: null,
  };

  it('counts white matches per set', () => {
    const outcome = scorePrediction(
      [
        { numbers: [4, 12, 27, 41, 63], powerball: 9, strategy: 'frequency' },
        { numbers: [4, 12, 30, 40, 50], powerball: 1, strategy: 'frequency' },
        { numbers: [1, 2, 3, 5, 6], powerball: 2, strategy: 'frequency' },
      ],
      actual,
    );

    expect(outcome.setResults[0]).toEqual({ whiteHits: 5, powerballHit: true });
    expect(outcome.setResults[1]).toEqual({ whiteHits: 2, powerballHit: false });
    expect(outcome.setResults[2]).toEqual({ whiteHits: 0, powerballHit: false });
    expect(outcome.bestWhiteHits).toBe(5);
  });

  it('scores the Powerball independently of the white balls', () => {
    // 9 is the Powerball; matching it as a white ball must not count.
    const outcome = scorePrediction(
      [{ numbers: [1, 2, 3, 5, 9], powerball: 9, strategy: 'frequency' }],
      actual,
    );
    expect(outcome.setResults[0]).toEqual({ whiteHits: 0, powerballHit: true });
  });
});

describe('prizeTier', () => {
  it.each([
    [5, true, 'Jackpot'],
    [5, false, 'Match 5'],
    [4, true, 'Match 4 + PB'],
    [3, false, 'Match 3'],
    [1, true, 'Match 1 + PB'],
    [0, true, 'Powerball only'],
  ])('%i whites, powerball %s -> %s', (whites, pb, expected) => {
    expect(prizeTier(whites, pb)).toBe(expected);
  });

  it('returns null for a losing line', () => {
    expect(prizeTier(2, false)).toBeNull();
    expect(prizeTier(0, false)).toBeNull();
  });
});
