import './load-env';

import { connectToDatabase, disconnectFromDatabase } from '@/lib/db';
import { Prediction } from '@/models/Prediction';
import { User } from '@/models/User';

/*
 * Bring the database in line with the current schemas.
 *
 * Needed because Mongoose's `autoIndex` only *creates* indexes — it never drops
 * one that has been removed or redefined. After changing an index declaration
 * the old one lingers and keeps enforcing the old rule, which is exactly how a
 * plain unique index survived the switch to a partial one and blocked
 * regeneration after a soft delete.
 *
 * This script only backfills a default and rebuilds indexes. It never deletes a
 * document.
 */
async function main() {
  await connectToDatabase();

  // Records written before `deletedAt` existed have no such field. Queries treat
  // a missing field as null, but the partial index is clearer with it present.
  const backfilled = await Prediction.updateMany(
    { deletedAt: { $exists: false } },
    { $set: { deletedAt: null } },
  );
  console.log(`backfilled deletedAt on ${backfilled.modifiedCount} prediction(s)`);

  for (const model of [User, Prediction]) {
    const dropped = await model.syncIndexes();
    console.log(
      `${model.modelName}: indexes synced${dropped.length > 0 ? ` (dropped ${dropped.join(', ')})` : ''}`,
    );
  }

  const indexes = await Prediction.collection.indexes();
  console.log('\npredictions indexes:');
  for (const index of indexes) {
    const flags = [
      index.unique ? 'UNIQUE' : '',
      index.partialFilterExpression
        ? `PARTIAL ${JSON.stringify(index.partialFilterExpression)}`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(`  ${JSON.stringify(index.key)}${flags ? `  ${flags}` : ''}`);
  }

  const total = await Prediction.countDocuments();
  const active = await Prediction.countDocuments({ deletedAt: null });
  console.log(`\npredictions: ${total} total, ${active} active, ${total - active} soft-deleted`);
}

main()
  .catch((error) => {
    console.error('\nSync failed:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());
