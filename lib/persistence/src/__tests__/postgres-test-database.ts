import { randomUUID } from "node:crypto";
import { PostgresClient } from "../client.js";

function getBaseTestDatabaseUrl(): string {
  const connectionString = process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL must be configured for Postgres integration tests.");
  }

  return connectionString;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll(`"`, `""`)}"`;
}

function createAdminConnectionString(baseConnectionString: string): string {
  const url = new URL(baseConnectionString);
  url.pathname = "/postgres";
  return url.toString();
}

function createDatabaseConnectionString(
  baseConnectionString: string,
  databaseName: string
): string {
  const url = new URL(baseConnectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export async function createIsolatedTestDatabase(prefix: string): Promise<{
  connectionString: string;
  dispose: () => Promise<void>;
}> {
  const baseConnectionString = getBaseTestDatabaseUrl();
  const databaseName = `${prefix}_${randomUUID().replaceAll("-", "").toLowerCase()}`;
  const adminClient = new PostgresClient({
    connectionString: createAdminConnectionString(baseConnectionString)
  });

  await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  await adminClient.close();

  return {
    connectionString: createDatabaseConnectionString(
      baseConnectionString,
      databaseName
    ),
    dispose: async () => {
      const cleanupClient = new PostgresClient({
        connectionString: createAdminConnectionString(baseConnectionString)
      });

      try {
        await cleanupClient.query(
          `SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [databaseName]
        );
        await cleanupClient.query(
          `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`
        );
      } finally {
        await cleanupClient.close();
      }
    }
  };
}
