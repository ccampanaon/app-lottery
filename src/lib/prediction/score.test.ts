import { describe, expect, it } from 'vitest';
import type { Draw } from '@/types';
import { computeStrategyPerformance } from './performance';
import { countCoverage, countMatches, distinctNumbersPlayed, expectedCoverage } from './score';

const actual: Draw = {
  drawDate: '2026-07-22T00:00:00.000Z',
  numbers: [4, 5, 22, 50, 58],
  powerball: 1,
  multiplier: null,
};

describe('countMatches', () => {
  it('counts every matching white ball', () => {
    expect(countMatches([4, 5, 22, 60, 61], 9, actual)).toEqual({
      whiteHits: 3,
      powerballHit: false,
    });
  });

  it('counts a full match', () => {
    expect(countMatches([4, 5, 22, 50, 58], 1, actual)).toEqual({
      whiteHits: 5,
      powerballHit: true,
    });
  });

  it('counts nothing when no ball matches', () => {
    expect(countMatches([1, 2, 3, 6, 7], 26, actual)).toEqual({
      whiteHits: 0,
      powerballHit: false,
    });
  });

  it('scores the Powerball independently of the white balls', () => {
    // The drawn Powerball is 1. Playing 1 as a *white* ball must not count as a
    // white hit, and must not count as a Powerball hit either.
    expect(countMatches([1, 2, 3, 6, 7], 9, actual)).toEqual({
      whiteHits: 0,
      powerballHit: false,
    });
  });

  it('matches the Powerball even when no white ball lands', () => {
    expect(countMatches([1, 2, 3, 6, 7], 1, actual)).toEqual({
      whiteHits: 0,
      powerballHit: true,
    });
  });

  it('counts a white ball that shares the Powerball value', () => {
    // 4 is a drawn white ball; playing it while also playing Powerball 1 scores
    // both, since the pools are independent.
    expect(countMatches([4, 2, 3, 6, 7], 1, actual)).toEqual({
      whiteHits: 1,
      powerballHit: true,
    });
  });
});

describe('countCoverage', () => {
  /** The 2026-07-25 draw, #1645. */
  const draw1645: Draw = {
    drawDate: '2026-07-25T00:00:00.000Z',
    numbers: [3, 4, 24, 36, 47],
    powerball: 17,
    multiplier: null,
  };

  /** The "Hot numbers" strategy exactly as it was generated for that draw. */
  const hotNumbers = [
    { numbers: [23, 27, 28, 47, 62], powerball: 4 },
    { numbers: [21, 23, 32, 63, 64], powerball: 4 },
    { numbers: [3, 28, 36, 59, 61], powerball: 18 },
    { numbers: [21, 32, 47, 61, 62], powerball: 21 },
    { numbers: [3, 21, 23, 33, 44], powerball: 20 },
  ];

  it('counts the distinct winning numbers found across every set', () => {
    // 47, then 3 and 36, then 47 again, then 3 again → {3, 36, 47} = 3.
    expect(countCoverage(hotNumbers, draw1645)).toEqual({
      whiteHits: 3,
      powerballHit: false,
    });
  });

  it('exceeds the best single line, which is what makes it a different metric', () => {
    const best = Math.max(
      ...hotNumbers.map((s) => countMatches(s.numbers, s.powerball, draw1645).whiteHits),
    );
    expect(best).toBe(2);
    expect(countCoverage(hotNumbers, draw1645).whiteHits).toBe(3);
  });

  it('does not double-count a number matched by several sets', () => {
    const repeated = [
      { numbers: [3, 10, 11, 12, 13], powerball: 1 },
      { numbers: [3, 20, 21, 22, 23], powerball: 2 },
      { numbers: [3, 30, 31, 32, 33], powerball: 3 },
    ];
    expect(countCoverage(repeated, draw1645).whiteHits).toBe(1);
  });

  it('reports the Powerball as hit when any single set matched it', () => {
    const sets = [
      { numbers: [1, 2, 5, 6, 7], powerball: 1 },
      { numbers: [8, 9, 10, 11, 12], powerball: 17 },
    ];
    expect(countCoverage(sets, draw1645)).toEqual({ whiteHits: 0, powerballHit: true });
  });

  it('caps at five even when every winning number is covered', () => {
    const sets = [
      { numbers: [3, 4, 24, 36, 47], powerball: 1 },
      { numbers: [3, 4, 24, 36, 47], powerball: 2 },
    ];
    expect(countCoverage(sets, draw1645).whiteHits).toBe(5);
  });

  it('returns zero for an empty set list', () => {
    expect(countCoverage([], draw1645)).toEqual({ whiteHits: 0, powerballHit: false });
  });
});

describe('distinctNumbersPlayed', () => {
  it('counts each number once across all sets', () => {
    expect(
      distinctNumbersPlayed([
        { numbers: [1, 2, 3, 4, 5], powerball: 1 },
        { numbers: [1, 2, 3, 4, 6], powerball: 2 },
      ]),
    ).toBe(6);
  });

  it('is zero for no sets', () => {
    expect(distinctNumbersPlayed([])).toBe(0);
  });
});

describe('expectedCoverage', () => {
  it('scales with how many numbers are in play', () => {
    // Playing all 69 covers all 5; playing none covers none.
    expect(expectedCoverage(69)).toBeCloseTo(5);
    expect(expectedCoverage(0)).toBe(0);
  });

  it('gives the fair yardstick for a typical five-set spread', () => {
    // ~22 distinct numbers over 5 sets -> 5 * 22/69 ≈ 1.59 expected.
    expect(expectedCoverage(22)).toBeCloseTo(1.594, 3);
  });
});

describe('computeStrategyPerformance', () => {
  const drawA: Draw = {
    drawDate: '2026-07-22T00:00:00.000Z',
    numbers: [4, 5, 22, 50, 58],
    powerball: 1,
    multiplier: null,
  };
  const drawB: Draw = {
    drawDate: '2026-07-25T00:00:00.000Z',
    numbers: [3, 4, 24, 36, 47],
    powerball: 17,
    multiplier: null,
  };
  const drawsByDate = new Map([
    ['2026-07-22', drawA],
    ['2026-07-25', drawB],
  ]);

  it('sums matches for a strategy across every published draw', () => {
    const result = computeStrategyPerformance(
      [
        {
          strategy: 'neural',
          targetDrawDate: drawA.drawDate,
          sets: [{ numbers: [4, 10, 11, 12, 13], powerball: 9 }],
        },
        {
          strategy: 'neural',
          targetDrawDate: drawB.drawDate,
          sets: [{ numbers: [3, 10, 11, 12, 13], powerball: 9 }],
        },
      ],
      drawsByDate,
    );

    // One match in each of two draws — the case from the dashboard request.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      strategy: 'neural',
      drawsScored: 2,
      totalMatches: 2,
      bestSingleLine: 1,
      totalSets: 2,
    });
    expect(result[0].averageMatches).toBe(1);
  });

  it('skips predictions whose draw has not been published', () => {
    const result = computeStrategyPerformance(
      [
        {
          strategy: 'ensemble',
          targetDrawDate: drawA.drawDate,
          sets: [{ numbers: [4, 5, 11, 12, 13], powerball: 1 }],
        },
        {
          // No entry in drawsByDate — still pending.
          strategy: 'ensemble',
          targetDrawDate: '2026-07-27T00:00:00.000Z',
          sets: [{ numbers: [1, 2, 3, 6, 7], powerball: 2 }],
        },
      ],
      drawsByDate,
    );

    expect(result[0].drawsScored).toBe(1);
    expect(result[0].totalMatches).toBe(2);
  });

  it('counts a Powerball hit once per draw, not once per set', () => {
    const result = computeStrategyPerformance(
      [
        {
          strategy: 'pairs',
          targetDrawDate: drawA.drawDate,
          sets: [
            { numbers: [10, 11, 12, 13, 14], powerball: 1 },
            { numbers: [15, 16, 17, 18, 19], powerball: 1 },
          ],
        },
      ],
      drawsByDate,
    );

    expect(result[0].powerballHits).toBe(1);
  });

  it('reports the best single line separately from the total', () => {
    const result = computeStrategyPerformance(
      [
        {
          strategy: 'frequency',
          targetDrawDate: drawA.drawDate,
          sets: [
            { numbers: [4, 5, 22, 10, 11], powerball: 9 },
            { numbers: [50, 12, 13, 14, 15], powerball: 9 },
          ],
        },
      ],
      drawsByDate,
    );

    // Coverage is 4 distinct; the best single ticket is 3.
    expect(result[0].totalMatches).toBe(4);
    expect(result[0].bestSingleLine).toBe(3);
  });

  it('ranks by total matches, best line breaking ties', () => {
    const result = computeStrategyPerformance(
      [
        {
          strategy: 'overdue',
          targetDrawDate: drawA.drawDate,
          sets: [{ numbers: [4, 10, 11, 12, 13], powerball: 9 }],
        },
        {
          strategy: 'markov',
          targetDrawDate: drawA.drawDate,
          sets: [{ numbers: [4, 5, 22, 11, 12], powerball: 9 }],
        },
      ],
      drawsByDate,
    );

    expect(result.map((r) => r.strategy)).toEqual(['markov', 'overdue']);
  });

  it('returns nothing when no draw has been published yet', () => {
    expect(
      computeStrategyPerformance(
        [
          {
            strategy: 'neural',
            targetDrawDate: '2026-07-27T00:00:00.000Z',
            sets: [{ numbers: [1, 2, 3, 4, 5], powerball: 6 }],
          },
        ],
        drawsByDate,
      ),
    ).toEqual([]);
  });

  it('reports an expected baseline alongside the total', () => {
    const result = computeStrategyPerformance(
      [
        {
          strategy: 'neural',
          targetDrawDate: drawA.drawDate,
          sets: [{ numbers: [4, 10, 11, 12, 13], powerball: 9 }],
        },
      ],
      drawsByDate,
    );

    // Five distinct numbers played -> 5 * 5/69 ≈ 0.362 expected.
    expect(result[0].expectedMatches).toBeCloseTo(0.362, 3);
  });
});
