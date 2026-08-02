import { describe, expect, it } from 'vitest';
import {
  easternNow,
  getNextDrawDate,
  getTargetDrawDate,
  isDrawDay,
  isTodaysDrawStillOpen,
} from './draw-schedule';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('isDrawDay', () => {
  it.each([
    ['2026-07-20', true, 'Monday'],
    ['2026-07-22', true, 'Wednesday'],
    ['2026-07-25', true, 'Saturday'],
    ['2026-07-21', false, 'Tuesday'],
    ['2026-07-23', false, 'Thursday'],
    ['2026-07-24', false, 'Friday'],
    ['2026-07-26', false, 'Sunday'],
  ])('%s -> %s (%s)', (date, expected) => {
    expect(isDrawDay(at(date))).toBe(expected);
  });
});

describe('getNextDrawDate', () => {
  it.each([
    ['2026-07-20', '2026-07-22'], // Mon -> Wed
    ['2026-07-22', '2026-07-25'], // Wed -> Sat
    ['2026-07-25', '2026-07-27'], // Sat -> Mon (crosses the week boundary)
  ])('from %s returns %s', (from, expected) => {
    expect(iso(getNextDrawDate(at(from)))).toBe(expected);
  });

  it('is strictly forward — a draw day never returns itself', () => {
    expect(iso(getNextDrawDate(at('2026-07-22')))).not.toBe('2026-07-22');
  });

  it('works from a non-draw day', () => {
    expect(iso(getNextDrawDate(at('2026-07-24')))).toBe('2026-07-25'); // Fri -> Sat
  });

  it('ignores the time of day on the input', () => {
    expect(iso(getNextDrawDate(new Date('2026-07-22T23:59:59.999Z')))).toBe('2026-07-25');
  });

  it('crosses a month boundary', () => {
    expect(iso(getNextDrawDate(at('2026-07-29')))).toBe('2026-08-01'); // Wed -> Sat
  });
});

describe('getTargetDrawDate', () => {
  it('targets the next draw after the latest published one', () => {
    const target = getTargetDrawDate(at('2026-07-22'), new Date('2026-07-24T16:00:00Z'));
    expect(iso(target)).toBe('2026-07-25');
  });

  it('never targets a date already past when the feed is lagging', () => {
    // Feed stuck three weeks back; "next after latest" would be long gone.
    const target = getTargetDrawDate(at('2026-07-01'), new Date('2026-07-24T16:00:00Z'));
    expect(iso(target)).toBe('2026-07-25');
  });

  it('targets today while today is a draw day whose draw has not happened', () => {
    // Sat 2026-07-25, 12:00 ET — well before the 22:59 draw.
    const target = getTargetDrawDate(at('2026-07-22'), new Date('2026-07-25T16:00:00Z'));
    expect(iso(target)).toBe('2026-07-25');
  });

  it('moves past today once the draw time has been reached', () => {
    // Sat 2026-07-25, 23:30 ET = 03:30 UTC on the 26th.
    const target = getTargetDrawDate(at('2026-07-22'), new Date('2026-07-26T03:30:00Z'));
    expect(iso(target)).toBe('2026-07-27');
  });

  it('does not target today once the feed has published today', () => {
    // Can't predict a draw whose result is already public.
    const target = getTargetDrawDate(at('2026-07-29'), new Date('2026-07-29T18:00:00Z'));
    expect(iso(target)).toBe('2026-08-01');
  });

  /*
   * The regression this replaced: reading "today" from UTC calendar parts.
   * 2026-07-30T00:58Z is still Wed 2026-07-29 20:58 ET — an hour before the
   * draw — but the UTC date has already rolled to Thursday. The old code
   * therefore skipped Wednesday entirely and targeted Saturday.
   */
  it('uses Eastern time, not UTC, to decide what day it is', () => {
    const justBeforeUtcMidnightEt = new Date('2026-07-30T00:58:00Z');
    expect(iso(getTargetDrawDate(at('2026-07-27'), justBeforeUtcMidnightEt))).toBe('2026-07-29');
  });

  it('handles the whole ET evening of a draw day', () => {
    // 18:00 through 22:58 ET on Wed 2026-07-29 — all still open.
    for (const utcHour of [22, 23, 24, 25, 26]) {
      const now = new Date(Date.UTC(2026, 6, 29, 0, 0) + utcHour * 60 * 60 * 1000);
      expect(iso(getTargetDrawDate(at('2026-07-27'), now))).toBe('2026-07-29');
    }
  });
});

describe('isTodaysDrawStillOpen', () => {
  it('is true on a draw day before the draw', () => {
    expect(isTodaysDrawStillOpen(new Date('2026-07-29T16:00:00Z'))).toBe(true); // 12:00 ET
  });

  it('is false on a draw day after the draw', () => {
    expect(isTodaysDrawStillOpen(new Date('2026-07-30T03:30:00Z'))).toBe(false); // 23:30 ET
  });

  it('is false on a day with no draw', () => {
    expect(isTodaysDrawStillOpen(new Date('2026-07-28T16:00:00Z'))).toBe(false); // Tuesday
  });
});

describe('easternNow', () => {
  it('reports the ET date and time, not UTC', () => {
    // 00:58 UTC on the 30th is 20:58 ET on the 29th (EDT, UTC-4).
    expect(easternNow(new Date('2026-07-30T00:58:00Z'))).toEqual({
      dateKey: '2026-07-29',
      minuteOfDay: 20 * 60 + 58,
    });
  });

  it('handles standard time as well as daylight time', () => {
    // January is EST (UTC-5): 00:58 UTC on the 15th is 19:58 ET on the 14th.
    expect(easternNow(new Date('2026-01-15T00:58:00Z'))).toEqual({
      dateKey: '2026-01-14',
      minuteOfDay: 19 * 60 + 58,
    });
  });

  it('reports midnight ET as minute zero', () => {
    // 04:10 UTC = 00:10 ET during EDT.
    expect(easternNow(new Date('2026-07-30T04:10:00Z'))).toEqual({
      dateKey: '2026-07-30',
      minuteOfDay: 10,
    });
  });
});
