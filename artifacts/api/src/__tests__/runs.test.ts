import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { FileAnalysisRunStore } from "@repo-guardian/runs";
import type { AnalyzeRepoResponse } from "@repo-guardian/shared-types";
import {
  CompareAnalysisRunsResponseSchema,
  GetAnalysisRunResponseSchema,
  ListAnalysisRunsResponseSchema,
  SaveAnalysisRunResponseSchema
} from "@repo-guardian/shared-types";
import { createRunsRouter } from "../routes/runs.js";

const tempDirs: string[] = [];

function createAnalysis(input?: {
  findingId?: string;
  repositoryFullName?: string;
}): AnalyzeRepoResponse {
  const findingId = input?.findingId;

  return {
    codeReviewFindingSummary: {
      findingsBySeverity: {
        critical: 0,
        high: findingId ? 1 : 0,
        info: 0,
        low: 0,
        medium: 0
      },
      isPartial: false,
      reviewedFileCount: 0,
      totalFindings: findingId ? 1 : 0
    },
    codeReviewFindings: findingId
      ? [
          {
            candidateIssue: true,
            candidatePr: true,
            category: "workflow-permissions",
            confidence: "high",
            evidence: [
              {
                label: "path",
                value: ".github/workflows/ci.yml"
              }
            ],
            id: findingId,
            lineSpans: [],
            paths: [".github/workflows/ci.yml"],
            recommendedAction: "Harden the workflow.",
            severity: "high",
            sourceType: "workflow",
            summary: "Workflow finding.",
            title: "Workflow finding"
          }
        ]
      : [],
    dependencyFindingSummary: {
      findingsBySeverity: {
        critical: 0,
        high: 0,
        info: 0,
        low: 0,
        medium: 0
      },
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
    fetchedAt: "2026-04-08T00:00:00.000Z",
    isPartial: false,
    issueCandidateSummary: {
      bySeverity: {
        critical: 0,
        high: findingId ? 1 : 0,
        info: 0,
        low: 0,
        medium: 0
      },
      byType: findingId
        ? [
            {
              candidateType: "workflow-hardening",
              count: 1
            }
          ]
        : [],
      totalCandidates: findingId ? 1 : 0
    },
    issueCandidates: findingId
      ? [
          {
            acceptanceCriteria: ["Harden the workflow."],
            affectedPackages: [],
            affectedPaths: [".github/workflows/ci.yml"],
            candidateType: "workflow-hardening",
            confidence: "high",
            id: `issue:${findingId}`,
            labels: ["workflow"],
            relatedFindingIds: [findingId],
            scope: "workflow-file",
            severity: "high",
            suggestedBody: "Harden the workflow.",
            summary: "Workflow issue.",
            title: "Workflow issue",
            whyItMatters: "Workflow permissions affect automation risk."
          }
        ]
      : [],
    prCandidateSummary: {
      byReadiness: findingId
        ? [
            {
              count: 1,
              readiness: "ready"
            }
          ]
        : [],
      byRiskLevel: findingId
        ? [
            {
              count: 1,
              riskLevel: "low"
            }
          ]
        : [],
      byType: findingId
        ? [
            {
              candidateType: "workflow-hardening",
              count: 1
            }
          ]
        : [],
      totalCandidates: findingId ? 1 : 0
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
      canonicalUrl: `https://github.com/${input?.repositoryFullName ?? "openai/openai-node"}`,
      defaultBranch: "main",
      description: "Test repository",
      forks: 0,
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
      samplePaths: [],
      totalDirectories: 0,
      totalFiles: 0,
      truncated: false
    },
    warningDetails: [],
    warnings: []
  };
}

async function createTestApp() {
  const rootDir = await mkdtemp(join(tmpdir(), "repo-guardian-api-runs-"));
  tempDirs.push(rootDir);

  const app = express();
  app.use(express.json());
  app.use("/api", createRunsRouter(new FileAnalysisRunStore({ rootDir })));

  return app;
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

describe("runs routes", () => {
  it("saves, lists, reopens, and compares analysis runs", async () => {
    const app = await createTestApp();
    const baseline = await request(app)
      .post("/api/runs")
      .send({
        analysis: createAnalysis({
          findingId: "finding:old"
        }),
        label: "Baseline"
      });
    const target = await request(app)
      .post("/api/runs")
      .send({
        analysis: createAnalysis({
          findingId: "finding:new"
        }),
        label: "Latest"
      });

    expect(baseline.status).toBe(201);
    expect(SaveAnalysisRunResponseSchema.safeParse(baseline.body).success).toBe(
      true
    );
    expect(target.status).toBe(201);

    const list = await request(app).get("/api/runs");
    expect(list.status).toBe(200);
    expect(ListAnalysisRunsResponseSchema.safeParse(list.body).success).toBe(true);
    expect(list.body.runs).toHaveLength(2);

    const reopened = await request(app).get(`/api/runs/${baseline.body.run.id}`);
    expect(reopened.status).toBe(200);
    expect(GetAnalysisRunResponseSchema.safeParse(reopened.body).success).toBe(
      true
    );
    expect(reopened.body.run.label).toBe("Baseline");

    const comparison = await request(app)
      .post("/api/runs/compare")
      .send({
        baseRunId: baseline.body.run.id,
        targetRunId: target.body.run.id
      });

    expect(comparison.status).toBe(200);
    expect(CompareAnalysisRunsResponseSchema.safeParse(comparison.body).success).toBe(
      true
    );
    expect(comparison.body.findings.newFindingIds).toEqual(["finding:new"]);
    expect(comparison.body.findings.resolvedFindingIds).toEqual(["finding:old"]);
  });

  it("returns 404 when reopening a missing run", async () => {
    const app = await createTestApp();
    const response = await request(app).get("/api/runs/missing-run");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Saved analysis run was not found."
    });
  });
});
