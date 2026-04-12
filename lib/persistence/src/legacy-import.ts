import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ExecutionActionPlanSchema, SavedAnalysisRunSchema, type SavedAnalysisRun } from "@repo-guardian/shared-types";
import { createAnalysisRunSummary } from "@repo-guardian/runs";
import { AnalysisRunRepository } from "./analysis-runs.js";
import { ExecutionPlanRepository, type StoredExecutionPlan } from "./execution-plans.js";

const LegacyStoredPlanSchema = z.object({
  actorUserId: z.string().nullable().optional(),
  analysisRunId: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  normalizedExecutionPayload: z.object({
    actions: z.array(ExecutionActionPlanSchema)
  }),
  planHash: z.string().min(1),
  planId: z.string().min(1),
  repositoryFullName: z.string().min(3),
  selectedIssueCandidateIds: z.array(z.string().min(1)),
  selectedPRCandidateIds: z.array(z.string().min(1)),
  status: z.enum(["planned", "executing", "completed", "failed"])
});

export type LegacyImportReport = {
  planSkipReasons: {
    alreadyImported: number;
    missingAnalysisRun: number;
    nonPlannedStatus: {
      completed: number;
      executing: number;
      failed: number;
    };
  };
  plansImported: number;
  plansSkipped: number;
  runSkipReasons: {
    alreadyImported: number;
  };
  runsImported: number;
  runsSkipped: number;
};

function getJsonFiles(entries: string[]): string[] {
  return entries.filter((entry) => entry.endsWith(".json")).sort();
}

function toStoredExecutionPlan(
  plan: z.infer<typeof LegacyStoredPlanSchema>,
  run: SavedAnalysisRun
): StoredExecutionPlan {
  const summary = createAnalysisRunSummary(run);
  const [owner = "", repo = ""] = summary.repositoryFullName.split("/");

  return {
    actions: plan.normalizedExecutionPayload.actions,
    actorUserId: plan.actorUserId ?? "usr_authenticated",
    analysisRunId: plan.analysisRunId,
    approval: {
      confirmationText: "I approve this GitHub write-back plan.",
      required: true
    },
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    planHash: plan.planHash,
    planId: plan.planId,
    repository: {
      defaultBranch: run.analysis.repository.defaultBranch,
      fullName: summary.repositoryFullName,
      owner,
      repo
    },
    selectedIssueCandidateIds: plan.selectedIssueCandidateIds,
    selectedPRCandidateIds: plan.selectedPRCandidateIds,
    summary: {
      approvalRequiredActions: plan.normalizedExecutionPayload.actions.length,
      blockedActions: plan.normalizedExecutionPayload.actions.filter(
        (action) => action.eligibility === "blocked"
      ).length,
      eligibleActions: plan.normalizedExecutionPayload.actions.filter(
        (action) => action.eligibility === "eligible"
      ).length,
      issueSelections: plan.selectedIssueCandidateIds.length,
      prSelections: plan.selectedPRCandidateIds.length,
      skippedActions: plan.normalizedExecutionPayload.actions.filter(
        (action) => action.eligibility === "ineligible"
      ).length,
      totalActions: plan.normalizedExecutionPayload.actions.length,
      totalSelections:
        plan.selectedIssueCandidateIds.length + plan.selectedPRCandidateIds.length
    }
  };
}

export async function importLegacyFileStores(input: {
  planRepository: ExecutionPlanRepository;
  plansRootDir?: string;
  runRepository: AnalysisRunRepository;
  runsRootDir?: string;
}): Promise<LegacyImportReport> {
  const report: LegacyImportReport = {
    planSkipReasons: {
      alreadyImported: 0,
      missingAnalysisRun: 0,
      nonPlannedStatus: {
        completed: 0,
        executing: 0,
        failed: 0
      }
    },
    plansImported: 0,
    plansSkipped: 0,
    runSkipReasons: {
      alreadyImported: 0
    },
    runsImported: 0,
    runsSkipped: 0
  };
  const importedRuns = new Map<string, SavedAnalysisRun>();

  if (input.runsRootDir) {
    const entries = await readdir(input.runsRootDir).catch(() => []);

    for (const entry of getJsonFiles(entries)) {
      const raw = await readFile(join(input.runsRootDir, entry), "utf8");
      const run = SavedAnalysisRunSchema.parse(JSON.parse(raw));
      const existedBefore = await input.runRepository
        .getRun(run.id)
        .then(() => true)
        .catch(() => false);
      await input.runRepository.upsertRun(run);
      importedRuns.set(run.id, run);
      if (existedBefore) {
        report.runsSkipped += 1;
        report.runSkipReasons.alreadyImported += 1;
      } else {
        report.runsImported += 1;
      }
    }
  }

  if (input.plansRootDir) {
    const entries = await readdir(input.plansRootDir).catch(() => []);

    for (const entry of getJsonFiles(entries)) {
      const raw = await readFile(join(input.plansRootDir, entry), "utf8");
      const plan = LegacyStoredPlanSchema.parse(JSON.parse(raw));

      if (plan.status !== "planned") {
        report.plansSkipped += 1;
        report.planSkipReasons.nonPlannedStatus[plan.status] += 1;
        continue;
      }

      const run =
        importedRuns.get(plan.analysisRunId) ??
        (await input.runRepository
          .getRun(plan.analysisRunId)
          .then((response) => response.run)
          .catch(() => null));

      if (!run) {
        report.plansSkipped += 1;
        report.planSkipReasons.missingAnalysisRun += 1;
        continue;
      }

      const inserted = await input.planRepository.upsertLegacyPlan(
        toStoredExecutionPlan(plan, run)
      );

      if (inserted) {
        report.plansImported += 1;
      } else {
        report.plansSkipped += 1;
        report.planSkipReasons.alreadyImported += 1;
      }
    }
  }

  return report;
}
