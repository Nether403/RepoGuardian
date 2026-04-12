import fs from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionActionPlan } from "@repo-guardian/shared-types";
import { env } from "./env.js";

export type StoredPlan = {
  planId: string;
  planHash: string;
  actorUserId: string;
  analysisRunId: string;
  repositoryFullName: string;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
  normalizedExecutionPayload: {
    actions: ExecutionActionPlan[];
  };
  status: "planned" | "executing" | "completed" | "failed";
  createdAt: string;
  expiresAt: string;
};

export class FilePlanStore {
  private readonly rootDir: string;

  constructor(options: { rootDir?: string } = {}) {
    this.rootDir =
      options.rootDir ??
      env.REPO_GUARDIAN_PLAN_STORE_DIR ??
      join(process.cwd(), ".repo-guardian", "plans");
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.rootDir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  private getFilePath(planId: string): string {
    return join(this.rootDir, `${planId}.json`);
  }

  private inMemoryLocks = new Map<string, Promise<void>>();

  public async savePlan(plan: StoredPlan): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(plan.planId);
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(plan, null, 2), "utf8");
    await fs.rename(tempPath, filePath);
  }

  public async getPlan(planId: string): Promise<StoredPlan | null> {
    try {
      const content = await fs.readFile(this.getFilePath(planId), "utf8");
      return JSON.parse(content) as StoredPlan;
    } catch {
      return null;
    }
  }

  public async transitionPlanStatus(
    planId: string,
    expectedStatus: StoredPlan["status"],
    nextStatus: StoredPlan["status"]
  ): Promise<boolean> {
    // 1. In-process mutex check (for the exact same Node process)
    const existingLock = this.inMemoryLocks.get(planId);
    if (existingLock) {
      await existingLock; // Wait for the previous transition to finish
    }

    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.inMemoryLocks.set(planId, lockPromise);

    try {
      // 2. Read and verify state
      const plan = await this.getPlan(planId);
      if (!plan || plan.status !== expectedStatus) {
        return false;
      }

      // 3. Mutate and atomic write
      plan.status = nextStatus;
      await this.savePlan(plan);
      return true;
    } finally {
      this.inMemoryLocks.delete(planId);
      releaseLock!();
    }
  }
}

export const defaultPlanStore = new FilePlanStore();
