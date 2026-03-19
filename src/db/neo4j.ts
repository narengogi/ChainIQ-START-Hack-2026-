import neo4j, { Driver, QueryResult, RecordShape, Session } from "neo4j-driver";

let driver: Driver | null = null;

const DEFAULT_DATABASE = process.env.NEO4J_DATABASE ?? "chainiq";

export function getDriver(): Driver {
  if (driver) return driver;

  const uri      = process.env.NEO4J_URI      ?? "bolt://127.0.0.1:7687";
  const user     = process.env.NEO4J_USER     ?? "neo4j";
  const password = process.env.NEO4J_PASSWORD ?? "chainiq_password";

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 5000,
    logging: neo4j.logging.console(
      process.env.NODE_ENV === "development" ? "debug" : "warn",
    ),
  });

  return driver;
}

/**
 * Open a session against the given database (defaults to NEO4J_DATABASE env
 * var or "chainiq"). Prefer `cypher()` for one-shot queries; use this
 * directly when you need explicit transaction control.
 */
export function getSession(database: string = DEFAULT_DATABASE): Session {
  return getDriver().session({ database });
}

/**
 * Run a Cypher query and return all records as plain objects.
 *
 * @example
 * const rows = await cypher<{ name: string }>(
 *   "MATCH (s:Supplier {category_l2: $cat}) RETURN s.name AS name",
 *   { cat: "Laptops" }
 * );
 */
export async function cypher<T extends RecordShape = RecordShape>(
  query: string,
  params: Record<string, unknown> = {},
  database: string = DEFAULT_DATABASE,
): Promise<T[]> {
  const session = getSession(database);
  try {
    const result: QueryResult = await session.run(query, params);
    return result.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

/**
 * Verify the driver can reach the server. Throws if the connection fails.
 */
export async function verifyConnectivity(): Promise<void> {
  await getDriver().verifyConnectivity({ database: DEFAULT_DATABASE });
}

/**
 * Close the driver — call on process exit.
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
