import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { SavedAnalysisRun } from "@repo-guardian/shared-types";
import { importLegacyFileStores } from "../legacy-import.js";

const tempDirs: string[] = [];

function createRun(runId: string): SavedAnalysisRun {
  return {
    analysis: {
      codeReviewFindingSummary: {
        findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
        isPartial: false,
        reviewedFileCount: 0,
        totalFindings: 0
      },
      codeReviewFindings: [],
      dependencyFindingSummary: {
        findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
        isPartial: false,
        totalFindings: 0,
        vulnerableDirectCount: 0,
        vulnerableTransitiveCount: 0
      },
      dependencyFindings: [],
      dependencySnapshot: {
        dependencies: [],
        filesParsed: [],
        filesSkipped: [],
        isPartial: false,
        parseWarningDetails: [],
        parseWarnings: [],
        summary: {
          byEcosystem: [],
          directDependencies: 0,
          parsedFileCount: 0,
          skippedFileCount: 0,
          totalDependencies: 0,
          transitiveDependencies: 0
        }
      },
      detectedFiles: {
        lockfiles: [],
        manifests: [],
        signals: []
      },
      ecosystems: [],
      fetchedAt: "2026-04-12T10:00:00.000Z",
      isPartial: false,
      issueCandidateSummary: {
        bySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
        byType: [],
        totalCandidates: 0
      },
      issueCandidates: [],
      prCandidateSummary: {
        byReadiness: [],
        byRiskLevel: [],
        byType: [],
        totalCandidates: 0
      },
      prCandidates: [],
      prPatchPlanSummary: {
        byPatchability: [],
        byValidationStatus: [],
        totalPatchCandidates: 0,
        totalPlans: 0
      },
      prPatchPlans: [],
      repository: {
        canonicalUrl: "https://github.com/openai/openai-node",
        defaultBranch: "main",
        description: "Test repository",
        forks: 0,
        fullName: "openai/openai-node",
        htmlUrl: "https://github.com/openai/openai-node",
        owner: "openai",
        primaryLanguage: "TypeScript",
        repo: "openai-node",
        stars: 1
      },
      reviewCoverage: {
        candidateFileCount: 0,
        isPartial: false,
        reviewedFileCount: 0,
        selectedFileCount: 0,
        selectedPaths: [],
        skippedFileCount: 0,
        skippedPaths: [],
        strategy: "targeted"
      },
      treeSummary: {
        samplePaths: [],
        totalDirectories: 0,
        totalFiles: 0,
        truncated: false
      },
      warningDetails: [],
      warnings: []
    },
    createdAt: "2026-04-12T10:01:00.000Z",
    id: runId,
    label: "Legacy run"
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        force: true,
        recursive: true
      })
    )
  );
});

describe("importLegacyFileStores", () => {
  it("imports runs idempotently and skips non-planned legacy plans", async () => {
    const runsRootDir = await mkdtemp(join(tmpdir(), "repo-guardian-runs-"));
    const plansRootDir = await mkdtemp(join(tmpdir(), "repo-guardian-plans-"));
    tempDirs.push(runsRootDir, plansRootDir);

    const run = createRun("legacy-run");
    await writeFile(
      join(runsRootDir, "legacy-run.json"),
      `${JSON.stringify(run, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(plansRootDir, "planned.json"),
      `${JSON.stringify({
        actorUserId: "usr_authenticated",
        analysisRunId: run.id,
        createdAt: "2026-04-12T10:02:00.000Z",
        expiresAt: "2026-04-12T10:17:00.000Z",
        normalizedExecutionPayload: {
          actions: [
            {
              affectedPackages: [],
              affectedPaths: [],
              approvalNotes: [],
              approvalRequired: true,
              approvalStatus: "required",
              attempted: false,
              blocked: false,
              branchName: null,
              commitSha: null,
              errorMessage: null,
              eligibility: "eligible",
              id: "action:one",
              issueNumber: null,
              issueUrl: null,
              linkedIssueCandidateIds: [],
              linkedPRCandidateIds: [],
              plannedSteps: ["Create issue"],
              pullRequestNumber: null,
              pullRequestUrl: null,
              reason: "Ready",
              succeeded: false,
              targetId: "issue:one",
              targetType: "issue_candidate",
              title: "Create issue",
              actionType: "create_issue"
            }
          ]
        },
        planHash: "sha256:test",
        planId: "plan_legacy",
        repositoryFullName: "openai/openai-node",
        selectedIssueCandidateIds: ["issue:one"],
        selectedPRCandidateIds: [],
        status: "planned"
      }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(plansRootDir, "completed.json"),
      `${JSON.stringify({
        actorUserId: "usr_authenticated",
        analysisRunId: run.id,
        createdAt: "2026-04-12T10:02:00.000Z",
        expiresAt: "2026-04-12T10:17:00.000Z",
        normalizedExecutionPayload: { actions: [] },
        planHash: "sha256:test-two",
        planId: "plan_completed",
        repositoryFullName: "openai/openai-node",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: [],
        status: "completed"
      }, null, 2)}\n`,
      "utf8"
    );

    const importedRuns = new Map<string, SavedAnalysisRun>();
    const importedPlans = new Set<string>();
    const runRepository = {
      async getRun(runId: string) {
        const existing = importedRuns.get(runId);

        if (!existing) {
          throw new Error("missing");
        }

        return {
          run: existing,
          summary: {
            blockedPatchPlans: 0,
            createdAt: existing.createdAt,
            defaultBranch: existing.analysis.repository.defaultBranch,
            executablePatchPlans: 0,
            fetchedAt: existing.analysis.fetchedAt,
            highSeverityFindings: 0,
            id: existing.id,
            issueCandidates: 0,
            label: existing.label,
            prCandidates: 0,
            repositoryFullName: existing.analysis.repository.fullName,
            totalFindings: 0
          }
        };
      },
      async upsertRun(input: SavedAnalysisRun) {
        importedRuns.set(input.id, input);
      }
    };
    const planRepository = {
      async upsertLegacyPlan(input: { planId: string }) {
        if (importedPlans.has(input.planId)) {
          return false;
        }

        importedPlans.add(input.planId);
        return true;
      }
    };

    const first = await importLegacyFileStores({
      planRepository: planRepository as never,
      plansRootDir,
      runRepository: runRepository as never,
      runsRootDir
    });
    const second = await importLegacyFileStores({
      planRepository: planRepository as never,
      plansRootDir,
      runRepository: runRepository as never,
      runsRootDir
    });

    expect(await readdir(runsRootDir)).toHaveLength(1);
    expect(first).toEqual({
      plansImported: 1,
      plansSkipped: 1,
      runsImported: 1,
      runsSkipped: 0
    });
    expect(second).toEqual({
      plansImported: 0,
      plansSkipped: 2,
      runsImported: 0,
      runsSkipped: 1
    });
  });
});
