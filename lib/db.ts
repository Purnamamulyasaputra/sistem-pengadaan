import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL has not been set in environment variables (.env)');
}

// Singleton: created once per warm serverless instance, not per-request
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // increased to handle parallel requests in local dev safely
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

// query() helper — strictly parameterized, no string interpolation allowed
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
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
