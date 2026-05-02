import { describe, expect, it, vi } from "vitest";
import {
  validateApprovedPatch,
  validateApprovedPlan
} from "../validate-patch.js";
import type {
  CodeReviewFinding,
  ExecutionActionPlan,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan,
  RepositoryMetadata
} from "@repo-guardian/shared-types";

const repository: RepositoryMetadata = {
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
};

const WORKFLOW_PATH = ".github/workflows/ci.yml";
const FINDING_ID = `review:workflow-permissions:${WORKFLOW_PATH}:3-3`;

function workflowFinding(): CodeReviewFinding {
  return {
    candidateIssue: true,
    candidatePr: true,
    category: "workflow-permissions",
    confidence: "high",
    evidence: [],
    id: FINDING_ID,
    lineSpans: [],
    paths: [WORKFLOW_PATH],
    recommendedAction: "Replace write-all with the minimum explicit permission set.",
    severity: "high",
    sourceType: "workflow",
    summary: "Broad workflow permissions increase token blast radius.",
    title: "Broad GitHub Actions permissions detected"
  };
}

function workflowCandidate(overrides: Partial<PRCandidate> = {}): PRCandidate {
  return {
    affectedPackages: [],
    affectedPaths: [WORKFLOW_PATH],
    candidateType: "workflow-hardening",
    confidence: "high",
    expectedFileChanges: [
      {
        changeType: "edit",
        path: WORKFLOW_PATH,
        reason: "Tighten workflow permissions."
      }
    ],
    id: "pr:workflow-hardening:.github/workflows/ci.yml",
    labels: ["candidate-pr", "security", "workflow", "high"],
    linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
    rationale: "The hardening change stays inside one workflow file.",
    readiness: "ready",
    relatedFindingIds: [FINDING_ID],
    riskLevel: "low",
    rollbackNote: "Restore the previous workflow permissions if legitimate jobs stop working.",
    severity: "high",
    summary: "Harden the CI workflow by reducing broad permissions.",
    testPlan: [],
    title: "Harden .github/workflows/ci.yml",
    ...overrides
  };
}

function workflowPatchPlan(overrides: Partial<PRPatchPlan> = {}): PRPatchPlan {
  return {
    affectedPackages: [],
    affectedPaths: [WORKFLOW_PATH],
    candidateType: "workflow-hardening",
    confidence: "high",
    id: "patch-plan:pr:workflow-hardening:.github/workflows/ci.yml",
    linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
    patchPlan: {
      constraints: [],
      filesPlanned: [
        {
          changeType: "edit",
          path: WORKFLOW_PATH,
          reason: "Tighten workflow permissions."
        }
      ],
      patchStrategy: "Replace broad workflow permissions with a minimal explicit block.",
      requiredHumanReview: [],
      requiredValidationSteps: []
    },
    patchWarnings: [],
    patchability: "patch_candidate",
    prCandidateId: "pr:workflow-hardening:.github/workflows/ci.yml",
    readiness: "ready",
    relatedFindingIds: [FINDING_ID],
    riskLevel: "low",
    severity: "high",
    title: "Harden .github/workflows/ci.yml",
    validationNotes: [],
    validationStatus: "ready",
    ...overrides
  };
}

function createAnalysis(overrides?: {
  codeReviewFindings?: CodeReviewFinding[];
  prCandidates?: PRCandidate[];
  prPatchPlans?: PRPatchPlan[];
}): ExecutionPlanningContext {
  return {
    codeReviewFindings: overrides?.codeReviewFindings ?? [workflowFinding()],
    dependencyFindings: [],
    issueCandidates: [],
    prCandidates: overrides?.prCandidates ?? [workflowCandidate()],
    prPatchPlans: overrides?.prPatchPlans ?? [workflowPatchPlan()],
    repository
  };
}

const ORIGINAL_WORKFLOW =
  "name: ci\non:\n  push:\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n";
const SYNTHESIZED_AFTER =
  "name: ci\non:\n  push:\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n";

function preparePatchAction(
  overrides: Partial<ExecutionActionPlan> = {}
): ExecutionActionPlan {
  return {
    actionType: "prepare_patch",
    affectedPackages: [],
    affectedPaths: [WORKFLOW_PATH],
    approvalRequired: true,
    blocked: false,
    diffPreview: {
      files: [
        {
          after: SYNTHESIZED_AFTER,
          afterTruncated: false,
          before: ORIGINAL_WORKFLOW,
          beforeTruncated: false,
          path: WORKFLOW_PATH,
          unifiedDiff: ""
        }
      ],
      synthesisError: null,
      truncated: false
    },
    eligibility: "eligible",
    id: "execution:prepare_patch:pr:workflow-hardening:.github/workflows/ci.yml",
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"],
    plannedSteps: [],
    reason: "Synthesize the workflow patch.",
    targetId: "pr:workflow-hardening:.github/workflows/ci.yml",
    targetType: "pr_candidate",
    title: "Prepare workflow hardening patch",
    ...overrides
  } as ExecutionActionPlan;
}

describe("validateApprovedPatch", () => {
  it("returns match when synthesised content equals approved after", async () => {
    const result = await validateApprovedPatch({
      action: preparePatchAction(),
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      }
    });

    expect(result.kind).toBe("match");
  });

  it("returns drift when the re-synthesised content diverges from the approved after", async () => {
    const result = await validateApprovedPatch({
      action: preparePatchAction({
        diffPreview: {
          files: [
            {
              after: "name: ci\npermissions: nothing-here\n",
              afterTruncated: false,
              before: ORIGINAL_WORKFLOW,
              beforeTruncated: false,
              path: WORKFLOW_PATH,
              unifiedDiff: ""
            }
          ],
          synthesisError: null,
          truncated: false
        }
      }),
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      }
    });

    expect(result.kind).toBe("drift");
    if (result.kind === "drift") {
      expect(result.driftPaths).toContain(WORKFLOW_PATH);
    }
  });

  it("returns synthesis_error when patch synthesis throws", async () => {
    const result = await validateApprovedPatch({
      action: preparePatchAction(),
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockRejectedValue(
          new Error("upstream 404 from GitHub")
        )
      }
    });

    expect(result.kind).toBe("synthesis_error");
    if (result.kind === "synthesis_error") {
      expect(result.message).toContain("upstream");
    }
  });

  it("returns missing_preview when the action has no diff preview", async () => {
    const action = preparePatchAction();
    (action as { diffPreview: unknown }).diffPreview = null;

    const result = await validateApprovedPatch({
      action,
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn()
      }
    });

    expect(result.kind).toBe("missing_preview");
  });

  it("returns missing_preview when the approved preview was truncated", async () => {
    const result = await validateApprovedPatch({
      action: preparePatchAction({
        diffPreview: {
          files: [
            {
              after: SYNTHESIZED_AFTER.slice(0, 20),
              afterTruncated: true,
              before: ORIGINAL_WORKFLOW,
              beforeTruncated: false,
              path: WORKFLOW_PATH,
              unifiedDiff: ""
            }
          ],
          synthesisError: null,
          truncated: false
        }
      }),
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      }
    });

    expect(result.kind).toBe("missing_preview");
    if (result.kind === "missing_preview") {
      expect(result.message).toContain("truncated");
      expect(result.message).toContain(WORKFLOW_PATH);
    }
  });

  it("returns missing_preview when only beforeTruncated is set on a file", async () => {
    const result = await validateApprovedPatch({
      action: preparePatchAction({
        diffPreview: {
          files: [
            {
              after: SYNTHESIZED_AFTER,
              afterTruncated: false,
              before: ORIGINAL_WORKFLOW.slice(0, 30),
              beforeTruncated: true,
              path: WORKFLOW_PATH,
              unifiedDiff: ""
            }
          ],
          synthesisError: null,
          truncated: false
        }
      }),
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      }
    });

    expect(result.kind).toBe("missing_preview");
  });

  it("returns missing_preview when the approved preview is flagged truncated at the envelope level", async () => {
    const result = await validateApprovedPatch({
      action: preparePatchAction({
        diffPreview: {
          files: [
            {
              after: SYNTHESIZED_AFTER,
              afterTruncated: false,
              before: ORIGINAL_WORKFLOW,
              beforeTruncated: false,
              path: WORKFLOW_PATH,
              unifiedDiff: ""
            }
          ],
          synthesisError: null,
          truncated: true
        }
      }),
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      }
    });

    expect(result.kind).toBe("missing_preview");
  });

  it("propagates a synthesis_error already recorded on the diff preview", async () => {
    const action = preparePatchAction({
      diffPreview: {
        files: [],
        synthesisError: "upstream went away during planning",
        truncated: false
      }
    });

    const result = await validateApprovedPatch({
      action,
      analysis: createAnalysis(),
      candidate: workflowCandidate(),
      patchPlan: workflowPatchPlan(),
      readClient: {
        fetchRepositoryFileText: vi.fn()
      }
    });

    expect(result.kind).toBe("synthesis_error");
    if (result.kind === "synthesis_error") {
      expect(result.message).toContain("upstream went away");
    }
  });
});

describe("validateApprovedPlan", () => {
  it("aggregates per-candidate match results", async () => {
    const result = await validateApprovedPlan({
      actions: [preparePatchAction()],
      analysis: createAnalysis(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      },
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(result.kind).toBe("match");
  });

  it("surfaces drift across candidates with offending paths", async () => {
    const result = await validateApprovedPlan({
      actions: [
        preparePatchAction({
          diffPreview: {
            files: [
              {
                after: "drifted contents",
                afterTruncated: false,
                before: ORIGINAL_WORKFLOW,
                beforeTruncated: false,
                path: WORKFLOW_PATH,
                unifiedDiff: ""
              }
            ],
            synthesisError: null,
            truncated: false
          }
        })
      ],
      analysis: createAnalysis(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(ORIGINAL_WORKFLOW)
      },
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(result.kind).toBe("drift");
    if (result.kind === "drift") {
      expect(result.details).toHaveLength(1);
      expect(result.details[0]?.driftPaths).toContain(WORKFLOW_PATH);
    }
  });

  it("propagates synthesis errors with their messages", async () => {
    const result = await validateApprovedPlan({
      actions: [preparePatchAction()],
      analysis: createAnalysis(),
      readClient: {
        fetchRepositoryFileText: vi.fn().mockRejectedValue(
          new Error("network unreachable")
        )
      },
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(result.kind).toBe("synthesis_error");
    if (result.kind === "synthesis_error") {
      expect(result.details[0]?.message).toContain("network unreachable");
    }
  });

  it("ignores actions whose candidates were not selected", async () => {
    const result = await validateApprovedPlan({
      actions: [
        preparePatchAction({
          diffPreview: {
            files: [
              {
                after: "would be drift",
                afterTruncated: false,
                before: ORIGINAL_WORKFLOW,
                beforeTruncated: false,
                path: WORKFLOW_PATH,
                unifiedDiff: ""
              }
            ],
            synthesisError: null,
            truncated: false
          }
        })
      ],
      analysis: createAnalysis(),
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      selectedPRCandidateIds: []
    });

    expect(result.kind).toBe("match");
  });
});
