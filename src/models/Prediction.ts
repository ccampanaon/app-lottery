import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  MAX_PREDICTION_SETS,
  POWERBALL_MAX,
  POWERBALL_MIN,
  PREDICTION_STRATEGIES,
  WHITE_BALL_COUNT,
  WHITE_BALL_MAX,
  WHITE_BALL_MIN,
  normalizeDrawDate,
} from '@/lib/constants';

/** One playable line. Subdocument — no _id of its own. */
const predictionSetSchema = new Schema(
  {
    numbers: {
      type: [Number],
      required: true,
      validate: [
        {
          validator: (v: number[]) => v.length === WHITE_BALL_COUNT,
          message: `A set must have exactly ${WHITE_BALL_COUNT} white balls`,
        },
        {
          validator: (v: number[]) =>
            v.every((n) => Number.isInteger(n) && n >= WHITE_BALL_MIN && n <= WHITE_BALL_MAX),
          message: `White balls must be whole numbers between ${WHITE_BALL_MIN} and ${WHITE_BALL_MAX}`,
        },
        {
          validator: (v: number[]) => new Set(v).size === v.length,
          message: 'White balls must all be different',
        },
      ],
    },
    powerball: {
      type: Number,
      required: true,
      min: POWERBALL_MIN,
      max: POWERBALL_MAX,
      validate: { validator: Number.isInteger, message: 'Powerball must be a whole number' },
    },
    strategy: { type: String, enum: PREDICTION_STRATEGIES, required: true },
    rationale: { type: String, maxlength: 500 },
  },
  { _id: false },
);

/*
 * The app stores predictions and users — nothing else. Historical results are
 * read live from the NY open-data feed, so there is no `draws` collection.
 */
const predictionSchema = new Schema(
  {
    /** The draw this prediction is for. Always a future or current draw at creation. */
    targetDrawDate: { type: Date, required: true },
    /**
     * Which strategy produced these sets. Stored at record level (as well as on
     * each set) so one generation becomes one record per strategy, and so the
     * uniqueness rule below can be expressed as an index.
     */
    strategy: { type: String, enum: PREDICTION_STRATEGIES, required: true },
    sets: {
      type: [predictionSetSchema],
      required: true,
      validate: [
        {
          validator: (v: unknown[]) => v.length >= 1,
          message: 'A prediction needs at least one set',
        },
        {
          validator: (v: unknown[]) => v.length <= MAX_PREDICTION_SETS,
          message: `At most ${MAX_PREDICTION_SETS} sets per prediction`,
        },
      ],
    },
    /** How many past draws the generator analysed; null means the full history. */
    analysisWindow: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /**
     * Soft delete. Predictions are never removed from the database — deleting
     * one stamps this instead, and every read filters on `deletedAt: null`.
     *
     * Generated numbers cannot be reproduced: each strategy samples with a
     * random seed, so a deleted record is gone for good and there is no way to
     * regenerate what it held. Keeping the row makes any deletion — a misclick,
     * or a careless script — reversible.
     */
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

predictionSchema.pre('validate', function normalize() {
  if (this.targetDrawDate) this.targetDrawDate = normalizeDrawDate(this.targetDrawDate);
  for (const set of this.sets ?? []) {
    if (Array.isArray(set.numbers)) set.numbers.sort((a, b) => a - b);
  }
});

// The predictions list is "mine, newest target first".
predictionSchema.index({ createdBy: 1, targetDrawDate: -1 });
// Scoring a past prediction looks up every prediction for a drawn date.
predictionSchema.index({ targetDrawDate: -1 });

/*
 * One *active* generation per strategy per draw, per user — enforced here rather
 * than only in the UI. Two rapid clicks on Generate would otherwise both pass an
 * "already generated?" read before either wrote, and produce duplicates; the
 * index makes the second write fail instead, which the route turns into a 409.
 *
 * Partial on `deletedAt: null` so soft-deleted rows do not occupy the key: after
 * deleting a strategy you can generate it again, and any number of superseded
 * copies can sit alongside the live one.
 */
predictionSchema.index(
  { createdBy: 1, targetDrawDate: 1, strategy: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

/** Listing and history both read "mine, active, newest target first". */
predictionSchema.index({ createdBy: 1, deletedAt: 1, targetDrawDate: -1 });

const HARD_DELETE_BLOCKED =
  'Predictions are soft-deleted — set `deletedAt` instead of removing the document. ' +
  'Generated numbers cannot be regenerated, so a hard delete is unrecoverable. ' +
  'If you genuinely need one, go through the raw driver collection deliberately.';

/*
 * Hard deletes are refused at the model layer.
 *
 * This is not hypothetical caution: a maintenance script once ran
 * `deleteMany({ createdBy })` to reset its own fixtures and destroyed the real
 * records for that account. Making the destructive path impossible by default,
 * and reachable only by bypassing Mongoose on purpose, is what stops that
 * happening a second time.
 */
predictionSchema.pre(
  ['deleteOne', 'deleteMany'],
  { query: true, document: false },
  function blockHardDelete() {
    throw new Error(HARD_DELETE_BLOCKED);
  },
);

predictionSchema.pre('findOneAndDelete', function blockHardDelete() {
  throw new Error(HARD_DELETE_BLOCKED);
});

export type PredictionDocument = InferSchemaType<typeof predictionSchema>;

export const Prediction: Model<PredictionDocument> =
  (models.Prediction as Model<PredictionDocument>) ||
  model<PredictionDocument>('Prediction', predictionSchema);
