import { DRAW_WEEKDAYS, normalizeDrawDate } from '@/lib/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Powerball draws are held at 22:59 in the game's own timezone. Until then, the
 * day's draw has not happened and is still open to predict.
 */
export const DRAW_TIMEZONE = 'America/New_York';
const DRAW_MINUTE_OF_DAY = 22 * 60 + 59;

export function isDrawDay(date: Date): boolean {
  return (DRAW_WEEKDAYS as readonly number[]).includes(date.getUTCDay());
}

/**
 * The next scheduled draw strictly after `after`.
 *
 * Draws are held Mon/Wed/Sat. Walking forward from a known date keeps this pure
 * calendar arithmetic with no notion of "now".
 */
export function getNextDrawDate(after: Date): Date {
  const cursor = normalizeDrawDate(after);

  for (let i = 1; i <= 7; i += 1) {
    const candidate = new Date(cursor.getTime() + i * DAY_MS);
    if (isDrawDay(candidate)) return candidate;
  }

  // Unreachable: three draw days a week means one always falls within 7 days.
  throw new Error('No draw day found within a week — DRAW_WEEKDAYS is misconfigured');
}

/**
 * "Now", as the lottery itself reckons it.
 *
 * Deliberately not UTC. A draw at 22:59 ET is 02:59 UTC the following day, so
 * for the whole ET evening the UTC calendar date is already tomorrow — and any
 * machine west of UTC flips date mid-afternoon local. Reading the date from UTC
 * therefore treats today's draw as finished hours before it happens, and the app
 * silently skips a draw the user could still predict. `Intl` handles DST, so EST
 * and EDT need no special casing.
 */
export function easternNow(now: Date): { dateKey: string; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DRAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  // `hour12: false` can render midnight as "24" in some environments.
  const hour = Number(get('hour')) % 24;

  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minuteOfDay: hour * 60 + Number(get('minute')),
  };
}

/** The ET calendar date, as a UTC-midnight Date to match stored draw dates. */
function easternToday(now: Date): Date {
  return new Date(`${easternNow(now).dateKey}T00:00:00.000Z`);
}

/** True when today is a draw day whose draw has not yet been held. */
export function isTodaysDrawStillOpen(now = new Date()): boolean {
  const { minuteOfDay } = easternNow(now);
  return isDrawDay(easternToday(now)) && minuteOfDay < DRAW_MINUTE_OF_DAY;
}

/**
 * The draw a prediction made now should target.
 *
 * The next draw after the most recent published result — but never one that has
 * already been held. Today counts as a valid target while its draw is still
 * pending, which is the whole point: on a draw day you can predict that day's
 * draw right up until it happens.
 */
export function getTargetDrawDate(latestPublishedDraw: Date, now = new Date()): Date {
  const today = easternToday(now);

  /*
   * Earliest date still predictable. Today qualifies only while its draw is
   * pending; once held, the earliest is tomorrow.
   */
  const earliest = isTodaysDrawStillOpen(now) ? today : new Date(today.getTime() + DAY_MS);

  let target = getNextDrawDate(latestPublishedDraw);
  while (target < earliest) {
    target = getNextDrawDate(target);
  }

  return target;
}
