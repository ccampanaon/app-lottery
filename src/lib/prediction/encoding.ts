import { POWERBALL_MAX, WHITE_BALL_MAX } from '@/lib/constants';
import type { Draw } from '@/types';

/** How many past draws the model sees when predicting the next one. */
export const WINDOW_SIZE = 10;

/** 69 white-ball slots + 26 Powerball slots per draw. */
export const FEATURES_PER_DRAW = WHITE_BALL_MAX + POWERBALL_MAX;
export const INPUT_SIZE = WINDOW_SIZE * FEATURES_PER_DRAW;

export const MODEL_DIR = 'public/model';
export const MODEL_URL = '/model/model.json';

/**
 * One draw → a 95-dim vector: a 69-dim multi-hot for the white balls (five 1s)
 * and a 26-dim one-hot for the Powerball.
 *
 * Shared by the training script and inference so the two can never disagree
 * about feature order — a mismatch there produces a model that runs happily and
 * predicts nonsense.
 */
export function encodeDraw(draw: Draw): number[] {
  const vector = new Array<number>(FEATURES_PER_DRAW).fill(0);

  for (const n of draw.numbers) {
    vector[n - 1] = 1;
  }
  vector[WHITE_BALL_MAX + draw.powerball - 1] = 1;

  return vector;
}

/** A window of draws (oldest → newest) flattened into the model's input vector. */
export function encodeWindow(window: Draw[]): number[] {
  return window.flatMap(encodeDraw);
}

/** Label vectors for the draw being predicted. */
export function encodeLabels(draw: Draw): { white: number[]; powerball: number[] } {
  const white = new Array<number>(WHITE_BALL_MAX).fill(0);
  for (const n of draw.numbers) white[n - 1] = 1;

  const powerball = new Array<number>(POWERBALL_MAX).fill(0);
  powerball[draw.powerball - 1] = 1;

  return { white, powerball };
}

/**
 * Build supervised examples from a chronological (oldest-first) history.
 * Example i predicts draw i from the WINDOW_SIZE draws before it.
 */
export function buildDataset(chronological: Draw[]) {
  const inputs: number[][] = [];
  const whiteLabels: number[][] = [];
  const powerballLabels: number[][] = [];

  for (let i = WINDOW_SIZE; i < chronological.length; i += 1) {
    inputs.push(encodeWindow(chronological.slice(i - WINDOW_SIZE, i)));
    const labels = encodeLabels(chronological[i]);
    whiteLabels.push(labels.white);
    powerballLabels.push(labels.powerball);
  }

  return { inputs, whiteLabels, powerballLabels };
}
