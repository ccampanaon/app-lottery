import { z } from 'zod';
import { MAX_PREDICTION_SETS, PREDICTION_STRATEGIES } from '@/lib/constants';
import { powerballSchema, whiteBallSetSchema } from './draw';

export const strategySchema = z.enum(PREDICTION_STRATEGIES);
export type Strategy = z.infer<typeof strategySchema>;

/** One playable line: five white balls plus a Powerball. */
export const predictionSetSchema = z.object({
  numbers: whiteBallSetSchema,
  powerball: powerballSchema,
  strategy: strategySchema,
  /** Human-readable justification shown beside the set, e.g. why these numbers. */
  rationale: z.string().max(500).optional(),
});

export type PredictionSet = z.infer<typeof predictionSetSchema>;

/**
 * A saved prediction: the draw it targets, plus up to ten playable lines.
 * Results themselves are not stored — this collection and `users` are the only
 * things the app persists.
 */
export const predictionInputSchema = z.object({
  targetDrawDate: z
    .string()
    .min(1, 'Required')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Enter a valid date' })
    .transform((v) => `${new Date(v).toISOString().slice(0, 10)}T00:00:00.000Z`),
  /** Omitted means "take it from the first set", which always carries one. */
  strategy: strategySchema.optional(),
  sets: z
    .array(predictionSetSchema)
    .min(1, 'A prediction needs at least one set')
    .max(MAX_PREDICTION_SETS, `At most ${MAX_PREDICTION_SETS} sets per prediction`),
  /** The window of past draws the generator analysed, for reproducibility. */
  analysisWindow: z.number().int().min(1).nullish(),
});

export type PredictionInput = z.infer<typeof predictionInputSchema>;

/** Query params for generating (not yet saving) a prediction. */
export const generateQuerySchema = z.object({
  /**
   * Omitted means "run every strategy" — the page compares them side by side
   * rather than asking the user to pick one up front. Naming a single strategy
   * still works, which keeps the endpoint useful on its own.
   */
  strategy: strategySchema.optional(),
  sets: z.coerce.number().int().min(1).max(MAX_PREDICTION_SETS).default(5),
  /** How many recent draws to analyse; omitted means the full history. */
  window: z.coerce.number().int().min(10).optional(),
});

export type GenerateQuery = z.infer<typeof generateQuerySchema>;
