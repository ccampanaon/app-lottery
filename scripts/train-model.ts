import './load-env';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { POWERBALL_MAX, WHITE_BALL_COUNT, WHITE_BALL_MAX } from '@/lib/constants';
import { getDraws } from '@/lib/powerball-feed';
import { INPUT_SIZE, MODEL_DIR, WINDOW_SIZE, buildDataset } from '@/lib/prediction/encoding';

/*
 * Trains the two-headed model and writes model.json + weights.bin to public/model.
 *
 * Runs on the pure-JS CPU backend rather than @tensorflow/tfjs-node. The native
 * package pulls ~49 dependencies with 15 known high/critical advisories for a
 * model this size — a few thousand parameters over ~1,300 examples trains in
 * seconds either way, so the native speedup does not pay for that surface.
 */

const EPOCHS = 60;
const BATCH_SIZE = 32;
const VALIDATION_FRACTION = 0.15;
/** Epochs without validation improvement before training stops. */
const PATIENCE = 8;

/** Writes artifacts by hand — the `file://` scheme needs tfjs-node, which we do not use. */
async function saveModel(model: tf.LayersModel, outputDir: string) {
  await mkdir(outputDir, { recursive: true });

  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const weightData = artifacts.weightData as ArrayBuffer;

      const modelJson = {
        modelTopology: artifacts.modelTopology,
        format: artifacts.format,
        generatedBy: artifacts.generatedBy,
        convertedBy: null,
        weightsManifest: [{ paths: ['weights.bin'], weights: artifacts.weightSpecs }],
      };

      await writeFile(path.join(outputDir, 'model.json'), JSON.stringify(modelJson));
      await writeFile(path.join(outputDir, 'weights.bin'), Buffer.from(weightData));

      return { modelArtifactsInfo: { dateSaved: new Date(0), modelTopologyType: 'JSON' } };
    }),
  );
}

function buildModel(): tf.LayersModel {
  const input = tf.input({ shape: [INPUT_SIZE] });

  const hidden = tf.layers
    .dense({ units: 256, activation: 'relu', name: 'hidden_1' })
    .apply(input) as tf.SymbolicTensor;
  const dropped = tf.layers.dropout({ rate: 0.3 }).apply(hidden) as tf.SymbolicTensor;
  const hidden2 = tf.layers
    .dense({ units: 128, activation: 'relu', name: 'hidden_2' })
    .apply(dropped) as tf.SymbolicTensor;

  /*
   * Two heads, because the two pools are independent:
   *   white — 69 sigmoids, multi-label (five are drawn at once)
   *   powerball — 26-way softmax, exactly one is drawn
   * A single softmax over 69 would wrongly model the whites as mutually exclusive.
   */
  const whiteHead = tf.layers
    .dense({ units: WHITE_BALL_MAX, activation: 'sigmoid', name: 'white' })
    .apply(hidden2) as tf.SymbolicTensor;
  const powerballHead = tf.layers
    .dense({ units: POWERBALL_MAX, activation: 'softmax', name: 'powerball' })
    .apply(hidden2) as tf.SymbolicTensor;

  const model = tf.model({ inputs: input, outputs: [whiteHead, powerballHead] });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: { white: 'binaryCrossentropy', powerball: 'categoricalCrossentropy' },
  });

  return model;
}

function argmax(row: number[]): number {
  return row.reduce((best, value, index) => (value > row[best] ? index : best), 0);
}

/** Average white-ball matches from the model's top five, plus Powerball accuracy. */
function evaluateTopFive(
  model: tf.LayersModel,
  inputs: number[][],
  whiteLabels: number[][],
  powerballLabels: number[][],
): { averageHits: number; powerballAccuracy: number } {
  const inputTensor = tf.tensor2d(inputs);
  const predictions = model.predict(inputTensor) as tf.Tensor[];
  const whiteProbabilities = predictions[0].arraySync() as number[][];
  const powerballProbabilities = predictions[1].arraySync() as number[][];

  let totalHits = 0;
  let powerballHits = 0;

  whiteProbabilities.forEach((row, i) => {
    const topFive = row
      .map((probability, index) => ({ probability, index }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, WHITE_BALL_COUNT)
      .map((entry) => entry.index);

    totalHits += topFive.filter((index) => whiteLabels[i][index] === 1).length;

    // Labels are one-hot, so the argmax of the label row is the true value.
    if (argmax(powerballProbabilities[i]) === argmax(powerballLabels[i])) {
      powerballHits += 1;
    }
  });

  predictions.forEach((tensor) => tensor.dispose());
  inputTensor.dispose();

  return {
    averageHits: totalHits / whiteProbabilities.length,
    powerballAccuracy: powerballHits / whiteProbabilities.length,
  };
}

async function main() {
  console.log('\n  Loading history from the NY open-data feed ...');
  const { draws } = await getDraws();

  // The feed is newest-first; training needs chronological order so a window
  // always precedes the draw it predicts.
  const chronological = [...draws].reverse();
  const { inputs, whiteLabels, powerballLabels } = buildDataset(chronological);

  const splitAt = Math.floor(inputs.length * (1 - VALIDATION_FRACTION));
  console.log(`  ${inputs.length} examples (window of ${WINDOW_SIZE} draws)`);
  console.log(`  train ${splitAt} · validate ${inputs.length - splitAt} (chronological split)\n`);

  const trainX = tf.tensor2d(inputs.slice(0, splitAt));
  const trainWhite = tf.tensor2d(whiteLabels.slice(0, splitAt));
  const trainPowerball = tf.tensor2d(powerballLabels.slice(0, splitAt));
  const valX = tf.tensor2d(inputs.slice(splitAt));
  const valWhite = tf.tensor2d(whiteLabels.slice(splitAt));
  const valPowerball = tf.tensor2d(powerballLabels.slice(splitAt));

  const model = buildModel();
  model.summary();

  const best: { loss: number; epoch: number; weights: tf.Tensor[] } = {
    loss: Infinity,
    epoch: 0,
    weights: [],
  };
  let epochsSinceImprovement = 0;

  await model.fit(trainX, [trainWhite, trainPowerball], {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [valX, [valWhite, valPowerball]],
    verbose: 0,
    /*
     * Early stopping and best-weight capture are both done here rather than with
     * `tf.callbacks.earlyStopping`, for two reasons:
     *   - that callback accepts `restoreBestWeights` in its type but throws
     *     "not implemented" at runtime, so it would leave the weights `patience`
     *     epochs *past* the best — already sliding into overfit;
     *   - mixing a Callback instance with a plain-object callback in the same
     *     array makes tfjs call setParams on the literal and crash.
     * Left unchecked, training runs to epoch 60 with train loss ~0.17 against
     * val loss ~0.30: the model memorising noise in a target that has none.
     */
    callbacks: {
      onEpochEnd(epoch: number, logs?: tf.Logs) {
        const valLoss = logs?.val_loss ?? Infinity;

        if (valLoss < best.loss) {
          best.weights.forEach((tensor) => tensor.dispose());
          best.loss = valLoss;
          best.epoch = epoch + 1;
          best.weights = model.getWeights().map((tensor) => tensor.clone());
          epochsSinceImprovement = 0;
        } else {
          epochsSinceImprovement += 1;
        }

        if ((epoch + 1) % 5 === 0) {
          console.log(
            `  epoch ${String(epoch + 1).padStart(3)}  loss ${logs?.loss?.toFixed(4)}  val_loss ${valLoss.toFixed(4)}`,
          );
        }

        if (epochsSinceImprovement >= PATIENCE) {
          console.log(`  stopping early — no improvement for ${PATIENCE} epochs`);
          model.stopTraining = true;
        }
      },
    },
  });

  if (best.weights.length > 0) {
    model.setWeights(best.weights);
    console.log(`\n  Restored weights from epoch ${best.epoch} (val_loss ${best.loss.toFixed(4)})`);
  }

  // Honest reporting: compare against the only meaningful baseline.
  const { averageHits, powerballAccuracy } = evaluateTopFive(
    model,
    inputs.slice(splitAt),
    whiteLabels.slice(splitAt),
    powerballLabels.slice(splitAt),
  );
  // Picking 5 of 69 at random matches 5 x (5/69) white balls on average.
  const randomBaseline = (WHITE_BALL_COUNT * WHITE_BALL_COUNT) / WHITE_BALL_MAX;
  const powerballBaseline = 1 / POWERBALL_MAX;

  const outputDir = path.join(process.cwd(), MODEL_DIR);
  await saveModel(model, outputDir);

  const delta = averageHits - randomBaseline;

  console.log('\n  ─── Validation ───');
  console.log(`  model top-5 white-ball hits per draw : ${averageHits.toFixed(4)}`);
  console.log(`  random-pick baseline                 : ${randomBaseline.toFixed(4)}`);
  console.log(
    `  difference                           : ${delta >= 0 ? '+' : ''}${delta.toFixed(4)}`,
  );
  console.log(`  model Powerball accuracy             : ${(powerballAccuracy * 100).toFixed(2)}%`);
  console.log(`  Powerball baseline (1 in 26)         : ${(powerballBaseline * 100).toFixed(2)}%`);
  console.log(
    '\n  A difference near zero is the CORRECT result. Powerball draws are\n' +
      '  independent and uniform, so no model can beat the baseline except by\n' +
      '  chance. A large positive number here would mean the split leaked, not\n' +
      '  that the lottery was solved.\n',
  );
  console.log(`  Saved to ${MODEL_DIR}/\n`);

  [trainX, trainWhite, trainPowerball, valX, valWhite, valPowerball].forEach((t) => t.dispose());
}

main().catch((error) => {
  console.error('\n  Training failed:', error instanceof Error ? error.message : error, '\n');
  process.exitCode = 1;
});
