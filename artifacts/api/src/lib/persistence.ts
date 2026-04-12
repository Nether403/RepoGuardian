import { join } from "node:path";
import {
  AnalysisJobRepository,
  AnalysisRunRepository,
  ExecutionPlanRepository,
  FleetStatusRepository,
  PostgresClient,
  RepositoryActivityRepository,
  SweepScheduleRepository,
  TrackedPullRequestRepository,
  TrackedRepositoryRepository
} from "@repo-guardian/persistence";
import { env } from "./env.js";

let client: PostgresClient | null = null;
let analysisJobRepository: AnalysisJobRepository | null = null;
let fleetStatusRepository: FleetStatusRepository | null = null;
let runRepository: AnalysisRunRepository | null = null;
let planRepository: ExecutionPlanRepository | null = null;
let repositoryActivityRepository: RepositoryActivityRepository | null = null;
let sweepScheduleRepository: SweepScheduleRepository | null = null;
let trackedPullRequestRepository: TrackedPullRequestRepository | null = null;
let trackedRepository: TrackedRepositoryRepository | null = null;

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

export function getAnalysisJobRepository(): AnalysisJobRepository {
  analysisJobRepository ??= new AnalysisJobRepository(getPostgresClient());
  return analysisJobRepository;
}

export function getFleetStatusRepository(): FleetStatusRepository {
  fleetStatusRepository ??= new FleetStatusRepository(getPostgresClient());
  return fleetStatusRepository;
}

export function getExecutionPlanRepository(): ExecutionPlanRepository {
  planRepository ??= new ExecutionPlanRepository(getPostgresClient());
  return planRepository;
}

export function getRepositoryActivityRepository(): RepositoryActivityRepository {
  repositoryActivityRepository ??= new RepositoryActivityRepository(getPostgresClient());
  return repositoryActivityRepository;
}

export function getSweepScheduleRepository(): SweepScheduleRepository {
  sweepScheduleRepository ??= new SweepScheduleRepository(getPostgresClient());
  return sweepScheduleRepository;
}

export function getTrackedPullRequestRepository(): TrackedPullRequestRepository {
  trackedPullRequestRepository ??= new TrackedPullRequestRepository(getPostgresClient());
  return trackedPullRequestRepository;
}

export function getTrackedRepositoryRepository(): TrackedRepositoryRepository {
  trackedRepository ??= new TrackedRepositoryRepository(getPostgresClient());
  return trackedRepository;
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
  analysisJobRepository = null;
  fleetStatusRepository = null;
  runRepository = null;
  planRepository = null;
  repositoryActivityRepository = null;
  sweepScheduleRepository = null;
  trackedPullRequestRepository = null;
  trackedRepository = null;
}
