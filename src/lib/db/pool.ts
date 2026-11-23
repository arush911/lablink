import { Pool } from "pg";
import { env } from "../env";

// Declare global variable for connection pool reuse in Next.js hot-reloading
declare global {
  var __lablink_pg_pool: Pool | undefined;
}

function createPool(): Pool {
  const isLocal = env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1");
  const isSsl = env.DATABASE_URL.includes("sslmode=require") || (!isLocal && env.NODE_ENV === "production");

  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = globalThis.__lablink_pg_pool ?? createPool();

if (env.NODE_ENV !== "production") {
  globalThis.__lablink_pg_pool = pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === "development" && duration > 200) {
      console.warn(`[Slow Query ${duration}ms]: ${text.slice(0, 100)}`);
    }
    return { rows: res.rows, rowCount: res.rowCount };
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
