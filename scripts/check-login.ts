import './load-env';

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

/*
 * Temporary diagnostic. Separates the three failures that all surface in the UI
 * as "Incorrect email or password":
 *   1. the cluster is unreachable (Atlas IP allowlist, bad URI)
 *   2. the account does not exist in the database the app actually opens
 *   3. the password genuinely does not match the stored hash
 */
async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'powerball';
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';

  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  console.log(`cluster : ${uri.replace(/:\/\/[^:]+:[^@]+@/, '://<redacted>@')}`);
  console.log(`database: ${dbName}`);
  console.log(`email   : ${email || '(SEED_ADMIN_EMAIL not set)'}\n`);

  console.log('[1] connecting...');
  const started = Date.now();
  try {
    await mongoose.connect(uri, { dbName, bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  } catch (error) {
    console.error(`    FAILED after ${Date.now() - started}ms`);
    console.error(`    ${(error as Error).message}`);
    console.error('\n    => Mongo is unreachable from here. Check the Atlas IP allowlist.');
    process.exit(1);
  }
  console.log(`    connected in ${Date.now() - started}ms`);

  const db = mongoose.connection.db!;
  console.log(`actual database in use: ${db.databaseName}`);

  const collections = await db.listCollections().toArray();
  console.log(`\n[2] collections: ${collections.map((c) => c.name).join(', ') || '(none)'}`);

  console.log('\n[3] users:');
  const users = await db
    .collection('users')
    .find({}, { projection: { email: 1, role: 1, passwordHash: 1 } })
    .toArray();

  if (users.length === 0) {
    console.log('    (none)');
    console.log('\n    => No account here. Run `npm run seed:admin` against THIS database.');
  }

  for (const user of users) {
    const hash = typeof user.passwordHash === 'string' ? user.passwordHash : '';
    console.log(
      `    ${user.email}  role=${user.role}  hash=${hash.slice(0, 7) || 'MISSING'}  len=${hash.length}`,
    );
  }

  if (email && password && users.length > 0) {
    const match = users.find((u) => u.email === email);
    console.log(`\n[4] password check for ${email}:`);
    if (!match) {
      console.log('    no such account in this database');
    } else if (typeof match.passwordHash !== 'string' || !match.passwordHash) {
      console.log('    account has no passwordHash stored');
    } else {
      const ok = await bcrypt.compare(password, match.passwordHash);
      console.log(`    SEED_ADMIN_PASSWORD ${ok ? 'MATCHES' : 'DOES NOT MATCH'} the stored hash`);
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
