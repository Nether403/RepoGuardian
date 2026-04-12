import { join } from "node:path";
import {
  AnalysisRunRepository,
  ExecutionPlanRepository,
  PostgresClient
} from "@repo-guardian/persistence";
import { env } from "./env.js";

let client: PostgresClient | null = null;
let runRepository: AnalysisRunRepository | null = null;
let planRepository: ExecutionPlanRepository | null = null;

function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before using durable persistence.");
  }

  return env.DATABASE_URL;
}

export function getPostgresClient(): PostgresClient {
  client ??= new PostgresClient({
    connectionString: requireDatabaseUrl()
  });

  return client;
}

export function getAnalysisRunRepository(): AnalysisRunRepository {
  runRepository ??= new AnalysisRunRepository(getPostgresClient());
  return runRepository;
}

export function getExecutionPlanRepository(): ExecutionPlanRepository {
  planRepository ??= new ExecutionPlanRepository(getPostgresClient());
  return planRepository;
}

export function getLegacyRunStoreDir(): string {
  return env.REPO_GUARDIAN_RUN_STORE_DIR ?? join(process.cwd(), ".repo-guardian", "runs");
}

export function getLegacyPlanStoreDir(): string {
  return env.REPO_GUARDIAN_PLAN_STORE_DIR ?? join(process.cwd(), ".repo-guardian", "plans");
}

export async function resetPersistenceCaches(): Promise<void> {
  await client?.close();
  client = null;
  runRepository = null;
  planRepository = null;
}
