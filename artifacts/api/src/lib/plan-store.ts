import fs from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionPlanResponse, ExecutionActionPlan } from "@repo-guardian/shared-types";
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

  constructor() {
    this.rootDir =
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

  public async savePlan(plan: StoredPlan): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.getFilePath(plan.planId), JSON.stringify(plan, null, 2), "utf8");
  }

  public async getPlan(planId: string): Promise<StoredPlan | null> {
    try {
      const content = await fs.readFile(this.getFilePath(planId), "utf8");
      return JSON.parse(content) as StoredPlan;
    } catch {
      return null;
    }
  }

  public async updatePlanStatus(planId: string, status: StoredPlan["status"]): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) throw new Error("Plan not found");
    plan.status = status;
    await this.savePlan(plan);
  }
}

export const defaultPlanStore = new FilePlanStore();
