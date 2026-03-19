import { closePool, query } from "./db/mysql";

async function main(): Promise<void> {
  const rows = await query("SELECT 1 + 1 AS result");
  console.log("DB connection OK:", rows[0]);
}

main()
  .catch(console.error)
  .finally(closePool);
