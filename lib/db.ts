import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL has not been set in environment variables (.env)');
}

// Singleton: created once per warm serverless instance, not per-request
// Neon serverless: keep max low to avoid connection exhaustion (free tier ~5 connections)
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,                       // Neon free tier: max 5, keep at 3 to leave headroom
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 10000,     // Release idle connections quickly (Neon charges per connection)
    connectionTimeoutMillis: 8000, // Fail fast — Neon cold starts usually < 5s
  });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Always assign to global so the pool is reused across hot reloads and invocations
globalForPg.pgPool = pool;

// query() helper — strictly parameterized, no string interpolation allowed
// Includes one automatic retry for transient Neon "connection terminated" errors
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    // Retry once on transient connection errors (Neon cold start / idle eviction)
    if (
      msg.includes('Connection terminated') ||
      msg.includes('connection timeout') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED')
    ) {
      console.warn('[db] Retrying query after transient connection error:', msg);
      await new Promise(r => setTimeout(r, 300)); // brief pause before retry
      return pool.query<T>(text, params);
    }
    throw err;
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let transactionError: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err: any) {
    transactionError = err;
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
    throw err;
  } finally {
    client.release(transactionError);
  }
}
