import { runMigrations } from "@repo-guardian/persistence";
import { pathToFileURL } from "node:url";
import { getPostgresClient } from "../lib/persistence.js";

export async function runDatabaseMigrations(): Promise<string[]> {
  return runMigrations(getPostgresClient());
}

async function main(): Promise<void> {
  const executed = await runDatabaseMigrations();

  if (executed.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  console.log(`Applied migrations: ${executed.join(", ")}`);
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
