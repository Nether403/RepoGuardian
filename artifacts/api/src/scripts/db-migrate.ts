import { runMigrations } from "@repo-guardian/persistence";
import { getPostgresClient } from "../lib/persistence.js";

async function main(): Promise<void> {
  const client = getPostgresClient();
  const executed = await runMigrations(client);

  if (executed.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  console.log(`Applied migrations: ${executed.join(", ")}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
