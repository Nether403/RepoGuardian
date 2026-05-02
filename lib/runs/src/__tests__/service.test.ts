import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalyzeRepoResponse } from "@repo-guardian/shared-types";
import {
  compareAnalysisRuns,
  FileAnalysisRunStore,
  isAnalysisRunStoreError
} from "../index.js";

const tempDirs: string[] = [];

function createAnalysis(input?: {
  executablePatchPlans?: number;
  fetchedAt?: string;
  findingIds?: string[];
  manifestPaths?: string[];
  repositoryFullName?: string;
}): AnalyzeRepoResponse {
  const findingIds = input?.findingIds ?? ["finding:one"];
  const executablePatchPlans = input?.executablePatchPlans ?? 0;

  return {
    codeReviewFindingSummary: {
      findingsBySeverity: {
        critical: 0,
        high: 0,
        info: 0,
        low: 0,
        medium: 0
      },
      isPartial: false,
      reviewedFileCount: 0,
      totalFindings: 0
    },
    codeReviewFindings: [],
    dependencyFindingSummary: {
      findingsBySeverity: {
        critical: 0,
        high: findingIds.length,
        info: 0,
        low: 0,
        medium: 0
      },
      isPartial: false,
      totalFindings: findingIds.length,
      vulnerableDirectCount: findingIds.length,
      vulnerableTransitiveCount: 0
    },
    dependencyFindings: findingIds.map((id) => ({
      advisoryId: id,
      advisorySource: "OSV",
      affectedRange: ">=0",
      candidateIssue: true,
      candidatePr: true,
      category: "dependency-vulnerability",
      confidence: "high",
      dependencyType: "production",
      evidence: [
        {
          label: "package",
          value: id
        }
      ],
      id,
      installedVersion: "1.0.0",
      isDirect: true,
      lineSpans: [],
      packageName: id,
      paths: ["package-lock.json", "package.json"],
      recommendedAction: "Upgrade the package.",
      referenceUrls: ["https://osv.dev/vulnerability/test"],
      remediationType: "upgrade",
      remediationVersion: "1.0.1",
      reachability: { band: "unknown", referencedPaths: [], score: 0, signals: [] },
      severity: "high",
      sourceType: "dependency",
      summary: `${id} summary`,
      title: `${id} advisory`
    })),
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
      lockfiles: [
        {
          kind: "package-lock.json",
          path: "package-lock.json"
        }
      ],
      manifests: (input?.manifestPaths ?? ["package.json"]).map((path) => ({
        kind: "package.json",
        path
      })),
      signals: []
    },
    ecosystems: [
      {
        ecosystem: "node",
        lockfiles: ["package-lock.json"],
        manifests: input?.manifestPaths ?? ["package.json"],
        packageManagers: ["npm"]
      }
    ],
    fetchedAt: input?.fetchedAt ?? "2026-04-08T00:00:00.000Z",
    isPartial: false,
    issueCandidateSummary: {
      bySeverity: {
        critical: 0,
        high: findingIds.length,
        info: 0,
        low: 0,
        medium: 0
      },
      byType: [
        {
          candidateType: "dependency-upgrade",
          count: findingIds.length
        }
      ],
      totalCandidates: findingIds.length
    },
    issueCandidates: findingIds.map((id) => ({
      acceptanceCriteria: ["Upgrade the dependency."],
      affectedPackages: [id],
      affectedPaths: ["package.json"],
      candidateType: "dependency-upgrade",
      confidence: "high",
      id: `issue:${id}`,
      labels: ["dependencies"],
      relatedFindingIds: [id],
      scope: "package",
      severity: "high",
      suggestedBody: "Upgrade the dependency.",
      summary: `${id} issue`,
      title: `${id} issue`,
      whyItMatters: "The dependency is vulnerable."
    })),
    prCandidateSummary: {
      byReadiness: [
        {
          count: findingIds.length,
          readiness: "ready"
        }
      ],
      byRiskLevel: [
        {
          count: findingIds.length,
          riskLevel: "low"
        }
      ],
      byType: [
        {
          candidateType: "dependency-upgrade",
          count: findingIds.length
        }
      ],
      totalCandidates: findingIds.length
    },
    prCandidates: findingIds.map((id) => ({
      affectedPackages: [id],
      affectedPaths: ["package.json"],
      candidateType: "dependency-upgrade",
      confidence: "high",
      expectedFileChanges: [
        {
          changeType: "edit",
          path: "package.json",
          reason: "Upgrade the dependency."
        }
      ],
      id: `pr:${id}`,
      labels: ["dependencies"],
      linkedIssueCandidateIds: [`issue:${id}`],
      rationale: "Bounded dependency update.",
      readiness: "ready",
      relatedFindingIds: [id],
      riskLevel: "low",
      rollbackNote: "Revert the dependency update.",
      severity: "high",
      summary: `${id} PR`,
      testPlan: ["Run tests."],
      title: `${id} PR`
    })),
    prPatchPlanSummary: {
      byPatchability: [
        {
          count: findingIds.length,
          patchability: "patch_candidate"
        }
      ],
      byValidationStatus: [
        {
          count: findingIds.length,
          validationStatus: "ready"
        }
      ],
      totalPatchCandidates: findingIds.length,
      totalPlans: findingIds.length
    },
    prPatchPlans: findingIds.map((id, index) => ({
      affectedPackages: [id],
      affectedPaths: ["package.json"],
      candidateType: "dependency-upgrade",
      confidence: "high",
      id: `patch-plan:pr:${id}`,
      linkedIssueCandidateIds: [`issue:${id}`],
      patchPlan: {
        constraints: ["Keep the patch bounded."],
        filesPlanned: [
          {
            changeType: "edit",
            path: "package.json",
            reason: "Upgrade the dependency."
          }
        ],
        patchStrategy: "Update the dependency.",
        requiredHumanReview: ["Review the diff."],
        requiredValidationSteps: ["Run tests."]
      },
      patchWarnings: [],
      patchability: "patch_candidate",
      prCandidateId: `pr:${id}`,
      readiness: "ready",
      relatedFindingIds: [id],
      riskLevel: "low",
      severity: "high",
      title: `${id} patch`,
      validationNotes: ["Ready."],
      validationStatus: "ready",
      writeBackEligibility: {
        approvalRequired: true,
        details: ["Deterministic."],
        status: index < executablePatchPlans ? "executable" : "blocked",
        summary: index < executablePatchPlans ? "Executable." : "Blocked."
      }
    })),
    repository: {
      canonicalUrl: `https://github.com/${input?.repositoryFullName ?? "openai/openai-node"}`,
      defaultBranch: "main",
      description: "Test repository",
      forks: 1,
      fullName: input?.repositoryFullName ?? "openai/openai-node",
      htmlUrl: `https://github.com/${input?.repositoryFullName ?? "openai/openai-node"}`,
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
      samplePaths: ["package.json"],
      totalDirectories: 0,
      totalFiles: 1,
      truncated: false
    },
    warningDetails: [],
    warnings: []
  };
}

async function createStore(): Promise<FileAnalysisRunStore> {
  const rootDir = await mkdtemp(join(tmpdir(), "repo-guardian-runs-"));
  tempDirs.push(rootDir);

  return new FileAnalysisRunStore({ rootDir });
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((rootDir) =>
      rm(rootDir, {
        force: true,
        recursive: true
      })
    )
  );
});

describe("FileAnalysisRunStore", () => {
  it("saves, lists, and reopens a saved analysis run", async () => {
    const store = await createStore();
    const saved = await store.saveRun({
      analysis: createAnalysis({
        executablePatchPlans: 1
      }),
      label: "Baseline"
    });

    expect(saved.summary).toMatchObject({
      blockedPatchPlans: 0,
      executablePatchPlans: 1,
      highSeverityFindings: 1,
      issueCandidates: 1,
      label: "Baseline",
      prCandidates: 1,
      repositoryFullName: "openai/openai-node",
      totalFindings: 1
    });

    await expect(store.listRuns()).resolves.toEqual([saved.summary]);
    await expect(store.getRun(saved.run.id)).resolves.toEqual(saved);
  });

  it("compares findings, candidates, eligibility, and structure across runs", () => {
    const baseRun = {
      analysis: createAnalysis({
        executablePatchPlans: 0,
        fetchedAt: "2026-04-08T00:00:00.000Z",
        findingIds: ["finding:old"],
        manifestPaths: ["package.json"]
      }),
      createdAt: "2026-04-08T00:01:00.000Z",
      id: "base",
      label: null
    };
    const targetRun = {
      analysis: createAnalysis({
        executablePatchPlans: 1,
        fetchedAt: "2026-04-08T00:02:00.000Z",
        findingIds: ["finding:new"],
        manifestPaths: ["package.json", "packages/app/package.json"]
      }),
      createdAt: "2026-04-08T00:03:00.000Z",
      id: "target",
      label: "Target"
    };

    expect(compareAnalysisRuns(baseRun, targetRun)).toMatchObject({
      candidates: {
        blockedPatchPlans: {
          base: 1,
          delta: -1,
          target: 0
        },
        executablePatchPlans: {
          base: 0,
          delta: 1,
          target: 1
        }
      },
      findings: {
        newFindingIds: ["finding:new"],
        resolvedFindingIds: ["finding:old"],
        total: {
          base: 1,
          delta: 0,
          target: 1
        }
      },
      structure: {
        manifests: {
          added: ["packages/app/package.json"],
          removed: [],
          unchanged: ["package.json"]
        }
      }
    });
  });

  it("blocks invalid run ids", async () => {
    const store = await createStore();

    await expect(store.getRun("../outside")).rejects.toSatisfy(
      (error: unknown) =>
        isAnalysisRunStoreError(error) && error.code === "invalid_run_id"
    );
  });
});
