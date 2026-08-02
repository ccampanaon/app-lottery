import mongoose from 'mongoose';
import { debugLog, describeError } from './debug-log';

/** Host only — the URI carries the password and must never reach a log. */
function redactUri(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return '<unparseable MONGODB_URI>';
  }
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

/*
 * Next.js clears the module registry on every Fast Refresh, so a connection held
 * in a module-level variable would leak a new socket pool on each edit. Caching
 * it on globalThis survives the reload and keeps exactly one pool per process.
 */
const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: MongooseCache;
};

const cached: MongooseCache = (globalForMongoose._mongooseCache ??= {
  conn: null,
  promise: null,
});

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    debugLog('db', 'reusing cached connection', { db: cached.conn.connection.db?.databaseName });
    return cached.conn;
  }

  // Read lazily rather than at module scope: importing a model must not throw
  // before the app has had a chance to load .env.local.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    debugLog('db', 'MONGODB_URI is missing from the environment');
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env.local and paste your Atlas connection string.',
    );
  }

  const dbName = process.env.MONGODB_DB || 'powerball';
  debugLog('db', 'opening new connection', {
    host: redactUri(uri),
    dbName,
    dbNameFromEnv: Boolean(process.env.MONGODB_DB),
  });

  const startedAt = Date.now();

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      /*
       * Set explicitly rather than relying on a path segment in the URI. Atlas's
       * "Connect" dialog hands you a string with no database in it, and Mongoose
       * silently falls back to "test" when one is absent — so the app's data
       * would land somewhere nobody thinks to look.
       */
      dbName,
      // Fail fast with a clear error instead of buffering queries forever when
      // the cluster is unreachable or the IP is not allow-listed.
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
    debugLog('db', 'connected', {
      ms: Date.now() - startedAt,
      db: cached.conn.connection.db?.databaseName,
    });
  } catch (error) {
    /*
     * Always logged, not gated: a connection failure here is the single most
     * likely cause of a deployment that builds cleanly and then rejects every
     * sign-in, and it is otherwise invisible — the login form reports it as
     * "Incorrect email or password".
     */
    console.error('[db] connection failed', {
      ms: Date.now() - startedAt,
      host: redactUri(uri),
      dbName,
      ...describeError(error),
    });

    // Clear the rejected promise so the next request retries rather than
    // replaying the same failure forever.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/** Close the pool — used by CLI scripts so the process can exit. */
export async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
