import './load-env';

import bcrypt from 'bcryptjs';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db';
import { User } from '@/models/User';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const name = (process.env.SEED_ADMIN_NAME ?? 'Administrator').trim();

  if (!email || !password) {
    console.error('\n  Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local first.\n');
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`\n  SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.\n`);
    process.exit(1);
  }

  await connectToDatabase();

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await User.findOne({ email });

  if (existing) {
    // Re-running is a deliberate password reset, not an error.
    existing.set({ passwordHash, name, role: 'admin' });
    await existing.save();
    console.log(`\n  Updated existing admin: ${email}`);
    console.log('  Password has been reset to the current SEED_ADMIN_PASSWORD.\n');
  } else {
    await User.create({ email, passwordHash, name, role: 'admin' });
    console.log(`\n  Created admin: ${email}\n`);
  }
}

main()
  .catch((error) => {
    console.error('\n  Seed failed:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
