import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  ExecutionResultSchema,
  type ExecutionPlanningContext
} from "@repo-guardian/shared-types";
import app from "../app.js";

function createAnalysisContext(): ExecutionPlanningContext {
  return {
    issueCandidates: [
      {
        acceptanceCriteria: ["Update the dependency and refresh the lockfile."],
        affectedPackages: ["react"],
        affectedPaths: ["package.json", "package-lock.json"],
        candidateType: "dependency-upgrade",
        confidence: "high",
        id: "issue:dependency-upgrade:react",
        labels: ["dependencies", "security"],
        relatedFindingIds: ["dependency:react"],
        scope: "package",
        severity: "high",
        suggestedBody: "Upgrade react to a non-affected version.",
        summary: "react requires a bounded upgrade.",
        title: "Upgrade react",
        whyItMatters: "The current direct dependency is vulnerable."
      }
    ],
    prCandidates: [
      {
        affectedPackages: ["react"],
        affectedPaths: ["package.json", "package-lock.json"],
        candidateType: "dependency-upgrade",
        confidence: "high",
        expectedFileChanges: [
          {
            changeType: "edit",
            path: "package.json",
            reason: "Update the direct dependency declaration."
          },
          {
            changeType: "edit",
            path: "package-lock.json",
            reason: "Refresh the lockfile after the version bump."
          }
        ],
        id: "pr:dependency-upgrade:react",
        labels: ["candidate-pr", "dependencies"],
        linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
        rationale: "The change is tightly bounded to one package upgrade.",
        readiness: "ready",
        relatedFindingIds: ["dependency:react"],
        riskLevel: "low",
        rollbackNote: "Restore the previous dependency version if regressions appear.",
        severity: "high",
        summary: "Upgrade react and refresh the lockfile.",
        testPlan: ["Install dependencies.", "Run tests."],
        title: "Upgrade react and refresh dependency locks"
      },
      {
        affectedPackages: [],
        affectedPaths: ["config/secrets.env"],
        candidateType: "secret-remediation",
        confidence: "medium",
        expectedFileChanges: [
          {
            changeType: "edit",
            path: "config/secrets.env",
            reason: "Remove the hardcoded credential."
          }
        ],
        id: "pr:secret-remediation:config-secrets",
        labels: ["candidate-pr", "security"],
        linkedIssueCandidateIds: [],
        rationale: "The remediation path needs coordination before any patch work.",
        readiness: "draft_only",
        relatedFindingIds: ["review:secret"],
        riskLevel: "high",
        rollbackNote: "Restore the previous config if the remediation breaks startup.",
        severity: "high",
        summary: "Remove the hardcoded secret from config/secrets.env.",
        testPlan: ["Validate startup with the replacement secret source."],
        title: "Remediate hardcoded secret in config/secrets.env"
      }
    ],
    prPatchPlans: [
      {
        affectedPackages: ["react"],
        affectedPaths: ["package.json", "package-lock.json"],
        candidateType: "dependency-upgrade",
        confidence: "high",
        linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
        patchPlan: {
          constraints: ["Keep the change limited to react version updates."],
          filesPlanned: [
            {
              changeType: "edit",
              path: "package.json",
              reason: "Update the direct dependency declaration."
            },
            {
              changeType: "edit",
              path: "package-lock.json",
              reason: "Refresh the lockfile after the version bump."
            }
          ],
          patchStrategy:
            "Edit the manifest and matching lockfile entries for the single package upgrade.",
          requiredHumanReview: ["Confirm the selected upgrade path is compatible."],
          requiredValidationSteps: ["Install dependencies.", "Run tests."]
        },
        patchWarnings: [],
        patchability: "patch_candidate",
        prCandidateId: "pr:dependency-upgrade:react",
        readiness: "ready",
        relatedFindingIds: ["dependency:react"],
        riskLevel: "low",
        severity: "high",
        title: "Upgrade react and refresh dependency locks",
        validationNotes: [
          "Validation has not been executed in this step.",
          "Standard validation is available once patch preparation exists."
        ],
        validationStatus: "ready"
      },
      {
        affectedPackages: [],
        affectedPaths: ["config/secrets.env"],
        candidateType: "secret-remediation",
        confidence: "medium",
        linkedIssueCandidateIds: [],
        patchPlan: {
          constraints: ["Coordinate any secret rotation outside this plan."],
          filesPlanned: [
            {
              changeType: "edit",
              path: "config/secrets.env",
              reason: "Remove the hardcoded credential."
            }
          ],
          patchStrategy: "Document the remediation path only.",
          requiredHumanReview: ["Confirm runtime secret injection expectations."],
          requiredValidationSteps: ["Verify the deployment secret source." ]
        },
        patchWarnings: [
          "Secret rotation requires runtime or ops coordination before patching."
        ],
        patchability: "not_patchable",
        prCandidateId: "pr:secret-remediation:config-secrets",
        readiness: "draft_only",
        relatedFindingIds: ["review:secret"],
        riskLevel: "high",
        severity: "high",
        title: "Remediate hardcoded secret in config/secrets.env",
        validationNotes: [
          "Validation has not been executed in this step.",
          "Patching is blocked until secret rotation coordination is complete."
        ],
        validationStatus: "blocked"
      }
    ],
    repository: {
      canonicalUrl: "https://github.com/openai/openai-node",
      defaultBranch: "main",
      description: "SDK repository",
      forks: 12,
      fullName: "openai/openai-node",
      htmlUrl: "https://github.com/openai/openai-node",
      owner: "openai",
      primaryLanguage: "TypeScript",
      repo: "openai-node",
      stars: 42
    }
  };
}

describe("POST /api/execution/plan", () => {
  it("returns a dry-run plan for selected issue and PR candidates", async () => {
    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      approvalRequired: true,
      approvalStatus: "required",
      mode: "dry_run",
      status: "planned",
      summary: {
        approvalRequiredActions: 2,
        blockedActions: 0,
        eligibleActions: 4,
        issueSelections: 1,
        prSelections: 1,
        skippedActions: 0,
        totalActions: 4,
        totalSelections: 2
      }
    });
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_issue",
          approvalRequired: true,
          approvalStatus: "required",
          eligibility: "eligible",
          linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
          linkedPRCandidateIds: [],
          targetId: "issue:dependency-upgrade:react"
        }),
        expect.objectContaining({
          actionType: "prepare_patch",
          approvalRequired: false,
          approvalStatus: "not_required",
          eligibility: "eligible",
          linkedPRCandidateIds: ["pr:dependency-upgrade:react"],
          targetId: "pr:dependency-upgrade:react"
        }),
        expect.objectContaining({
          actionType: "validate_patch",
          eligibility: "eligible",
          linkedPRCandidateIds: ["pr:dependency-upgrade:react"]
        }),
        expect.objectContaining({
          actionType: "create_pr",
          approvalRequired: true,
          approvalStatus: "required",
          eligibility: "eligible",
          linkedPRCandidateIds: ["pr:dependency-upgrade:react"]
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("blocks non-patchable and unknown selections", async () => {
    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:missing"],
      selectedPRCandidateIds: [
        "pr:secret-remediation:config-secrets",
        "pr:missing"
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("blocked");
    expect(response.body.summary).toMatchObject({
      blockedActions: 3,
      eligibleActions: 0,
      totalActions: 3
    });
    expect(response.body.warnings).toEqual(
      expect.arrayContaining([
        "Secret rotation requires runtime or ops coordination before patching.",
        "The selected issue candidate ID does not exist in the provided analysis context.",
        "The selected PR candidate ID does not exist in the provided analysis context."
      ])
    );
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "skip",
          eligibility: "blocked",
          targetId: "issue:missing"
        }),
        expect.objectContaining({
          actionType: "skip",
          eligibility: "blocked",
          targetId: "pr:secret-remediation:config-secrets"
        }),
        expect.objectContaining({
          actionType: "skip",
          eligibility: "blocked",
          targetId: "pr:missing"
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("returns a structured blocked result for execute_approved", async () => {
    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      mode: "execute_approved",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      approvalRequired: true,
      approvalStatus: "required",
      errors: ["Execution mode execute_approved is not supported in Milestone 5A."],
      mode: "execute_approved",
      status: "blocked"
    });
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_issue",
          eligibility: "blocked",
          reason: "execute_approved is not supported in Milestone 5A."
        }),
        expect.objectContaining({
          actionType: "create_pr",
          eligibility: "blocked",
          reason: "execute_approved is not supported in Milestone 5A."
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("returns 400 for an invalid execution request", async () => {
    const response = await request(app).post("/api/execution/plan").send({
      mode: "dry_run",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: []
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Required"
    });
  });
});
