import { z } from 'zod';
import {
  MATRIX_START_DATE,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  POWERBALL_MAX,
  POWERBALL_MIN,
  WHITE_BALL_COUNT,
  WHITE_BALL_MAX,
  WHITE_BALL_MIN,
} from '@/lib/constants';

export const whiteBallSchema = z
  .number({ error: 'Enter a number' })
  .int('Whole numbers only')
  .min(WHITE_BALL_MIN, `Must be at least ${WHITE_BALL_MIN}`)
  .max(WHITE_BALL_MAX, `Must be at most ${WHITE_BALL_MAX}`);

export const powerballSchema = z
  .number({ error: 'Enter a number' })
  .int('Whole numbers only')
  .min(POWERBALL_MIN, `Must be at least ${POWERBALL_MIN}`)
  .max(POWERBALL_MAX, `Must be at most ${POWERBALL_MAX}`);

/** Five distinct white balls, stored sorted so a line has one canonical form. */
export const whiteBallSetSchema = z
  .array(whiteBallSchema)
  .length(WHITE_BALL_COUNT, `Enter exactly ${WHITE_BALL_COUNT} numbers`)
  .refine((nums) => new Set(nums).size === nums.length, {
    message: 'The five numbers must all be different',
  })
  .transform((nums) => [...nums].sort((a, b) => a - b));

/** ISO date string pinned to a UTC calendar date. */
const isoDrawDate = z
  .string({ error: 'Enter a valid date' })
  .min(1, 'Required')
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Enter a valid date' })
  .transform((v) => `${new Date(v).toISOString().slice(0, 10)}T00:00:00.000Z`);

/**
 * A row from the NY open-data feed. Results are no longer stored locally, but
 * third-party data still gets validated exactly as strictly as user input would
 * be — a malformed row should be reported and skipped, never silently trusted.
 */
export const feedRowSchema = z.object({
  drawDate: isoDrawDate.refine((v) => new Date(v) >= MATRIX_START_DATE, {
    message: 'Predates the 69/26 number matrix',
  }),
  numbers: whiteBallSetSchema,
  powerball: powerballSchema,
  multiplier: z
    .number()
    .int()
    .min(MULTIPLIER_MIN)
    .max(MULTIPLIER_MAX)
    .nullish()
    .transform((v) => v ?? null),
});

export type FeedRow = z.infer<typeof feedRowSchema>;

/**
 * A `YYYY-MM-DD` day key. Draw dates are stored as ISO strings pinned to UTC
 * midnight, so comparing on this prefix lets range filters be plain string
 * comparisons — no Date objects, no timezone drift.
 */
const dayKey = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Enter a valid date' })
  .transform((v) => new Date(v).toISOString().slice(0, 10));

/** Query params for the read-only results table, applied over the cached feed. */
export const drawListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.enum(['drawDate', '-drawDate']).default('-drawDate'),
  from: dayKey.optional(),
  to: dayKey.optional(),
});

export type DrawListQuery = z.infer<typeof drawListQuerySchema>;
