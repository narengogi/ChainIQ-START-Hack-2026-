import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host:     process.env.DB_HOST     ?? "127.0.0.1",
    port:     Number(process.env.DB_PORT ?? 3306),
    user:     process.env.DB_USER     ?? "chainiq_user",
    password: process.env.DB_PASSWORD ?? "chainiq_password",
    database: process.env.DB_NAME     ?? "chainiq",
    charset:  "utf8mb4",
    // Keep connections alive; the pool grows on demand up to connectionLimit.
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });

  return pool;
}

/**
 * Run a single query via the shared pool.
 * Rows are returned as plain objects; fields metadata is discarded.
 */
export async function query<T = mysql.RowDataPacket>(
  sql: string,
  values?: unknown[],
): Promise<T[]> {
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(sql, values);
  return rows as T[];
}

/**
 * Close the pool — call on process exit if needed.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
