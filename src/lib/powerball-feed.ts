import { MATRIX_START_DATE } from '@/lib/constants';
import { feedRowSchema } from '@/lib/validation/draw';
import type { Draw } from '@/types';

/*
 * Historical results are read from the New York State Gaming Commission's open
 * data (Socrata dataset d6yy-54nr) rather than stored locally — Powerball is a
 * single national game, so this feed is authoritative and a local mirror could
 * only ever drift from it.
 *
 * One row per draw:
 *   { draw_date: "2026-07-22T00:00:00.000",
 *     winning_numbers: "04 05 22 50 58 01",   // 5 whites then the Powerball
 *     multiplier: "3",
 *     double_play_winning_numbers: "09 51 ..." }
 */
const DATASET_URL = 'https://data.ny.gov/resource/d6yy-54nr.json';
const PAGE_SIZE = 1000;

/** Draws land Mon/Wed/Sat ~22:59 ET; an hour of staleness is imperceptible. */
const CACHE_TTL_MS = 60 * 60 * 1000;

type SocrataRow = {
  draw_date?: string;
  winning_numbers?: string;
  multiplier?: string;
  // `double_play_winning_numbers` is deliberately ignored: Double Play is a
  // separate optional side game with its own drawing. Folding it in would
  // double-count and corrupt every frequency statistic in the app.
};

export type FeedResult = {
  draws: Draw[];
  fetchedAt: number;
  /** True when the network failed and a previously cached copy was served. */
  stale: boolean;
  /** Rows the feed published that failed validation, with a reason. */
  rejected: { drawDate: string; reason: string }[];
};

type FeedCache = {
  result: FeedResult | null;
  inflight: Promise<FeedResult> | null;
};

// Survives Fast Refresh, and — more importantly — means concurrent requests
// share one upstream fetch instead of stampeding Socrata with 1,379 rows each.
const globalForFeed = globalThis as typeof globalThis & { _powerballFeed?: FeedCache };
const cache: FeedCache = (globalForFeed._powerballFeed ??= { result: null, inflight: null });

function parseRow(row: SocrataRow): { draw: Draw } | { error: string; drawDate: string } {
  const rawDate = row.draw_date ?? '';

  if (!rawDate) return { error: 'missing draw_date', drawDate: '(none)' };
  if (!row.winning_numbers) return { error: 'missing winning_numbers', drawDate: rawDate };

  /*
   * Socrata sends a "floating timestamp" with no zone: "2026-07-22T00:00:00.000".
   * `new Date(...)` reads that as local midnight, which in any UTC+ zone lands on
   * the previous UTC day and shifts every draw back by one. Take the calendar
   * date portion and pin it to UTC.
   */
  const drawDate = `${rawDate.slice(0, 10)}T00:00:00.000Z`;

  const tokens = row.winning_numbers.trim().split(/\s+/);
  if (tokens.length !== 6) {
    return {
      error: `expected 6 numbers, got ${tokens.length} ("${row.winning_numbers}")`,
      drawDate: rawDate,
    };
  }

  const values = tokens.map((t) => Number.parseInt(t, 10));
  const multiplier = row.multiplier ? Number.parseInt(row.multiplier, 10) : null;

  // Third-party data: validate it exactly as strictly as we would a user's input.
  const parsed = feedRowSchema.safeParse({
    drawDate,
    numbers: values.slice(0, 5),
    powerball: values[5],
    multiplier: Number.isNaN(multiplier as number) ? null : multiplier,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      drawDate: rawDate,
    };
  }

  return { draw: parsed.data };
}

async function fetchPage(offset: number, signal?: AbortSignal): Promise<SocrataRow[]> {
  const params = new URLSearchParams({
    $limit: String(PAGE_SIZE),
    $offset: String(offset),
    $order: 'draw_date DESC',
    // Rows before this date used the 59/35 matrix, where balls 60-69 could not
    // be drawn at all. Mixing them in would skew every frequency statistic.
    $where: `draw_date >= '${MATRIX_START_DATE.toISOString().slice(0, 19)}'`,
  });

  const response = await fetch(`${DATASET_URL}?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
    // Opt out of Next's fetch cache — freshness is managed by this module's own
    // TTL, which also caches the *parsed* result rather than the raw payload.
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Socrata returned ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as SocrataRow[];
}

async function loadFromSource(): Promise<FeedResult> {
  const draws: Draw[] = [];
  const rejected: FeedResult['rejected'] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = await fetchPage(offset);
    if (rows.length === 0) break;

    for (const row of rows) {
      const parsed = parseRow(row);
      if ('error' in parsed) {
        rejected.push({ drawDate: parsed.drawDate, reason: parsed.error });
      } else {
        draws.push(parsed.draw);
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  // Newest first — the default ordering for the results table, "latest draw"
  // lookups, and the sliding windows the prediction strategies work over.
  draws.sort((a, b) => b.drawDate.localeCompare(a.drawDate));

  return { draws, fetchedAt: Date.now(), stale: false, rejected };
}

/**
 * All historical draws, newest first. Cached in-process for an hour; concurrent
 * callers share a single upstream fetch.
 */
export async function getDraws({ force = false } = {}): Promise<FeedResult> {
  const fresh = cache.result && Date.now() - cache.result.fetchedAt < CACHE_TTL_MS;
  if (!force && fresh && cache.result) return cache.result;

  cache.inflight ??= loadFromSource()
    .then((result) => {
      cache.result = result;
      return result;
    })
    .catch((error: unknown) => {
      /*
       * A dashboard that goes blank because a third party had a bad minute is
       * worse than one showing hour-old numbers. Serve the last good copy,
       * flagged stale so the UI can say so; only fail outright if we have
       * nothing cached at all.
       */
      if (cache.result) {
        return { ...cache.result, stale: true };
      }
      throw error;
    })
    .finally(() => {
      cache.inflight = null;
    });

  return cache.inflight;
}

/** The most recent published draw, or null when the feed is empty. */
export async function getLatestDraw(): Promise<Draw | null> {
  const { draws } = await getDraws();
  return draws[0] ?? null;
}
