import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { WHITE_BALL_COUNT, WHITE_BALL_MAX } from '@/lib/constants';
import type { Draw } from '@/types';
import { WINDOW_SIZE, encodeWindow } from './encoding';
import { sampleWithoutReplacement, samplePowerball } from './rng';
import type { GeneratedSet } from './types';

/*
 * Server-side inference.
 *
 * The plan originally called for running this in the browser. Loading it here
 * instead keeps 1.1MB of weights off the client entirely — the page only ever
 * receives six numbers — and keeps all seven strategies on one code path. The
 * cost is a little server CPU per request, which for a 288k-parameter model on
 * a single input row is negligible.
 *
 * This module must never be imported from a client component: it reads the
 * filesystem and pulls in the whole TFJS runtime.
 */

/*
 * Cached on globalThis, not in a module variable.
 *
 * Next clears the module registry on every Fast Refresh, but TFJS keeps its
 * variable registry on the global object. A module-level cache is therefore
 * reset while the registry is not, so the next request loads the model a second
 * time and TFJS throws "Variable with name hidden_1/kernel was already
 * registered". Caching where TFJS itself lives keeps the two in step.
 */
const globalForModel = globalThis as typeof globalThis & {
  _powerballModel?: Promise<tf.LayersModel> | null;
};

export class ModelUnavailableError extends Error {
  constructor() {
    super('The neural model has not been trained yet. Run `npm run train:model` first.');
    this.name = 'ModelUnavailableError';
  }
}

async function loadModel(): Promise<tf.LayersModel> {
  /*
   * The path segments are written out as literals rather than joined from the
   * MODEL_DIR constant. Turbopack cannot see through an imported binding, so it
   * treats the read as unbounded and traces the entire project into the server
   * bundle. Statically scoped literals keep the trace to this one folder.
   */
  const directory = path.join(process.cwd(), 'public', 'model');

  let modelJson: string;
  let weights: Buffer;

  try {
    [modelJson, weights] = await Promise.all([
      readFile(path.join(directory, 'model.json'), 'utf8'),
      readFile(path.join(directory, 'weights.bin')),
    ]);
  } catch {
    throw new ModelUnavailableError();
  }

  const parsed = JSON.parse(modelJson) as {
    modelTopology: unknown;
    weightsManifest: { weights: tf.io.WeightsManifestEntry[] }[];
  };

  /*
   * `tf.loadLayersModel('file://…')` needs the tfjs-node IO handler, which this
   * project deliberately does not install. Reading the artifacts and handing
   * them over in memory does the same job with no native dependency.
   */
  return tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: parsed.modelTopology,
      weightSpecs: parsed.weightsManifest[0].weights,
      weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength),
    }),
  );
}

/** Loaded once per process — reading and deserialising 1.1MB per request would be waste. */
function getModel(): Promise<tf.LayersModel> {
  globalForModel._powerballModel ??= loadModel().catch((error: unknown) => {
    // Clear the rejection so a later request retries rather than replaying it.
    globalForModel._powerballModel = null;
    throw error;
  });
  return globalForModel._powerballModel;
}

export type NeuralPrediction = {
  whiteProbabilities: number[];
  powerballProbabilities: number[];
};

/** Run the model over the most recent draws. */
export async function predictNext(draws: Draw[]): Promise<NeuralPrediction> {
  if (draws.length < WINDOW_SIZE) {
    throw new Error(`The model needs at least ${WINDOW_SIZE} past draws.`);
  }

  const model = await getModel();

  // The feed is newest-first; training fed windows oldest→newest, so reverse.
  const window = draws.slice(0, WINDOW_SIZE).reverse();
  const input = tf.tensor2d([encodeWindow(window)]);

  const outputs = model.predict(input) as tf.Tensor[];
  const whiteProbabilities = (outputs[0].arraySync() as number[][])[0];
  const powerballProbabilities = (outputs[1].arraySync() as number[][])[0];

  input.dispose();
  outputs.forEach((tensor) => tensor.dispose());

  return { whiteProbabilities, powerballProbabilities };
}

/**
 * Sets sampled from the model's output distribution.
 *
 * Sampled rather than "take the top five" so repeated calls differ — and
 * because the distribution is very nearly uniform, which is the honest result
 * for an independent draw. Presenting its top five as though they were a signal
 * would overstate what the model found.
 */
export async function generateNeuralSets(
  draws: Draw[],
  count: number,
  rng: () => number,
): Promise<GeneratedSet[]> {
  const { whiteProbabilities, powerballProbabilities } = await predictNext(draws);

  const whitePool = whiteProbabilities.map((probability, index) => ({
    value: index + 1,
    weight: probability,
  }));
  const powerballPool = powerballProbabilities.map((probability, index) => ({
    value: index + 1,
    weight: probability,
  }));

  // How far the model strayed from "every ball equally likely".
  const uniformWhite = WHITE_BALL_COUNT / WHITE_BALL_MAX;
  const spread = Math.max(...whiteProbabilities) - Math.min(...whiteProbabilities);

  const sets: GeneratedSet[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 12 && sets.length < count; attempt += 1) {
    const numbers = sampleWithoutReplacement(whitePool, WHITE_BALL_COUNT, rng);
    const powerball = samplePowerball(powerballPool, rng);
    const key = `${numbers.join('-')}|${powerball}`;
    if (seen.has(key)) continue;

    seen.add(key);
    sets.push({
      numbers,
      powerball,
      strategy: 'neural',
      rationale:
        `Sampled from a ${WHITE_BALL_MAX}-output sigmoid model trained on windows of ${WINDOW_SIZE} draws. ` +
        `Its predicted probabilities span just ${(spread * 100).toFixed(2)} points around the ` +
        `${(uniformWhite * 100).toFixed(1)}% each ball would have if all were equally likely — ` +
        `the model found essentially no signal, which is the expected result for an independent draw.`,
    });
  }

  return sets;
}
