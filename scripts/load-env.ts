import { config } from 'dotenv';

/*
 * Next loads .env.local automatically; standalone `tsx` scripts do not. Load the
 * same files Next would, in the same precedence order (first write wins in
 * dotenv, so .env.local must come first).
 */
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n  Missing ${name}. Set it in .env.local and try again.\n`);
    process.exit(1);
  }
  return value;
}
