import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { QueryResultRow } from "pg";
import { PostgresClient } from "./client.js";

type AppliedMigrationRow = QueryResultRow & {
  id: string;
};

function getMigrationsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
}

export async function runMigrations(client: PostgresClient): Promise<string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const [filesResult, appliedResult] = await Promise.all([
    readdir(getMigrationsDir()),
    client.query<AppliedMigrationRow>("SELECT id FROM schema_migrations")
  ]);
  const applied = new Set(
    appliedResult.rows.map((row: AppliedMigrationRow) => row.id)
  );
  const files = filesResult
    .filter((file: string) => file.endsWith(".sql"))
    .sort();
  const executed: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(join(getMigrationsDir(), file), "utf8");
    await client.transaction(async (session) => {
      await session.query(sql);
      await session.query(
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        [file]
      );
    });
    executed.push(file);
  }

  return executed;
}
