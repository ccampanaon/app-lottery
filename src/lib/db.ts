import mongoose from 'mongoose';

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
  if (cached.conn) return cached.conn;

  // Read lazily rather than at module scope: importing a model must not throw
  // before the app has had a chance to load .env.local.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env.local and paste your Atlas connection string.',
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      /*
       * Set explicitly rather than relying on a path segment in the URI. Atlas's
       * "Connect" dialog hands you a string with no database in it, and Mongoose
       * silently falls back to "test" when one is absent — so the app's data
       * would land somewhere nobody thinks to look.
       */
      dbName: process.env.MONGODB_DB || 'powerball',
      // Fail fast with a clear error instead of buffering queries forever when
      // the cluster is unreachable or the IP is not allow-listed.
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
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
