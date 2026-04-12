import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  type ExecutionActionPlan,
  type ExecutionPlanDetailResponse,
  type ExecutionPlanEventsResponse,
  type ExecutionPlanResponse,
  ExecutionResultSchema,
  ExecutionPlanResponseSchema,
  type AnalyzeRepoResponse,
  type CodeReviewFinding,
  type DependencyFinding,
  type IssueCandidate,
  type PRCandidate,
  type PRPatchPlan,
  type SavedAnalysisRun
} from "@repo-guardian/shared-types";
import { PersistenceError } from "@repo-guardian/persistence";
import { createAnalysisRunSummary } from "@repo-guardian/runs";
import { createExecutionRouter } from "../routes/execution.js";

function createIssueCandidate(
  overrides: Partial<IssueCandidate> = {}
): IssueCandidate {
  return {
    acceptanceCriteria: [
      "Replace write-all with the minimum required permissions.",
      "Re-run the workflow after the hardening change."
    ],
    affectedPackages: [],
    affectedPaths: [".github/workflows/ci.yml"],
    candidateType: "workflow-hardening",
    confidence: "high",
    id: "issue:workflow-hardening:.github/workflows/ci.yml",
    labels: ["security", "workflow", "high"],
    relatedFindingIds: ["review:workflow-permissions:.github/workflows/ci.yml:3-3"],
    scope: "workflow-file",
    severity: "high",
    suggestedBody: "Harden the CI workflow permissions.",
    summary: "The workflow permissions are broader than necessary.",
    title: "Harden workflow .github/workflows/ci.yml",
    whyItMatters: "Broad workflow permissions increase the blast radius of token misuse.",
    ...overrides
  };
}

function createPRCandidate(
  overrides: Partial<PRCandidate> = {}
): PRCandidate {
  return {
    affectedPackages: [],
    affectedPaths: [".github/workflows/ci.yml"],
    candidateType: "workflow-hardening",
    confidence: "high",
    expectedFileChanges: [
      {
        changeType: "edit",
        path: ".github/workflows/ci.yml",
        reason: "Tighten workflow permissions in the existing workflow file."
      }
    ],
    id: "pr:workflow-hardening:.github/workflows/ci.yml",
    labels: ["candidate-pr", "security", "workflow", "high"],
    linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
    rationale: "The hardening change stays inside one workflow file.",
    readiness: "ready",
    relatedFindingIds: ["review:workflow-permissions:.github/workflows/ci.yml:3-3"],
    riskLevel: "low",
    rollbackNote: "Restore the previous workflow permissions if legitimate jobs stop working.",
    severity: "high",
    summary: "Harden the CI workflow by reducing broad permissions.",
    testPlan: [
      "Run the workflow after the permissions change.",
      "Confirm privileged jobs still have the minimum access they need."
    ],
    title: "Harden .github/workflows/ci.yml",
    ...overrides
  };
}

function createPRPatchPlan(
  overrides: Partial<PRPatchPlan> = {}
): PRPatchPlan {
  return {
    affectedPackages: [],
    affectedPaths: [".github/workflows/ci.yml"],
    candidateType: "workflow-hardening",
    confidence: "high",
    id: "patch-plan:pr:workflow-hardening:.github/workflows/ci.yml",
    linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
    patchPlan: {
      constraints: ["Keep the change inside one workflow file."],
      filesPlanned: [
        {
          changeType: "edit",
          path: ".github/workflows/ci.yml",
          reason: "Tighten workflow permissions in the existing workflow file."
        }
      ],
      patchStrategy:
        "Replace broad workflow permissions with a minimal explicit permissions block.",
      requiredHumanReview: ["Confirm the workflow still has the minimum permissions it needs."],
      requiredValidationSteps: [
        "Run the workflow after the permissions change.",
        "Confirm privileged jobs still have the minimum access they need."
      ]
    },
    patchWarnings: [],
    patchability: "patch_candidate",
    prCandidateId: "pr:workflow-hardening:.github/workflows/ci.yml",
    readiness: "ready",
    relatedFindingIds: ["review:workflow-permissions:.github/workflows/ci.yml:3-3"],
    riskLevel: "low",
    severity: "high",
    title: "Harden .github/workflows/ci.yml",
    validationNotes: ["Validation has not been executed in this step."],
    validationStatus: "ready",
    ...overrides
  };
}

function createWorkflowFinding(
  overrides: Partial<CodeReviewFinding> = {}
): CodeReviewFinding {
  return {
    candidateIssue: true,
    candidatePr: true,
    category: "workflow-permissions",
    confidence: "high",
    evidence: [
      {
        label: "Matched line",
        value: "permissions: write-all"
      }
    ],
    id: "review:workflow-permissions:.github/workflows/ci.yml:3-3",
    lineSpans: [
      {
        endLine: 3,
        path: ".github/workflows/ci.yml",
        startLine: 3
      }
    ],
    paths: [".github/workflows/ci.yml"],
    recommendedAction: "Replace write-all with the minimum explicit permission set.",
    severity: "high",
    sourceType: "workflow",
    summary: "Broad workflow permissions increase token blast radius.",
    title: "Broad GitHub Actions permissions detected",
    ...overrides
  };
}

function createDependencyFinding(
  overrides: Partial<DependencyFinding> = {}
): DependencyFinding {
  return {
    advisoryId: "GHSA-test-1234",
    advisorySource: "OSV",
    affectedRange: "introduced 0, fixed 2.0.0",
    candidateIssue: true,
    candidatePr: true,
    category: "dependency-vulnerability",
    confidence: "high",
    dependencyType: "production",
    evidence: [],
    id: "dependency:react:1",
    installedVersion: "1.0.0",
    isDirect: true,
    lineSpans: [],
    packageName: "react",
    paths: ["package-lock.json", "package.json"],
    recommendedAction: "Upgrade react to 2.0.0 and refresh the lockfile.",
    referenceUrls: ["https://osv.dev/vulnerability/GHSA-test-1234"],
    remediationType: "upgrade",
    remediationVersion: "2.0.0",
    severity: "high",
    sourceType: "dependency",
    summary: "react is affected by a dependency advisory.",
    title: "react is affected by GHSA-test-1234",
    ...overrides
  };
}

function createDependencyIssueCandidate(
  overrides: Partial<IssueCandidate> = {}
): IssueCandidate {
  return {
    acceptanceCriteria: [
      "Upgrade react to the remediated version.",
      "Refresh the root package-lock.json entries for react.",
      "Re-run the affected validation commands."
    ],
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    id: "issue:dependency-upgrade:react",
    labels: ["dependencies", "security", "high"],
    relatedFindingIds: ["dependency:react:1"],
    scope: "package",
    severity: "high",
    suggestedBody: "Upgrade react to the remediated version.",
    summary: "react should be upgraded to the remediated version.",
    title: "Upgrade react",
    whyItMatters: "The repository directly depends on a vulnerable version of react.",
    ...overrides
  };
}

function createDependencyPRCandidate(
  overrides: Partial<PRCandidate> = {}
): PRCandidate {
  return {
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    expectedFileChanges: [
      {
        changeType: "edit",
        path: "package-lock.json",
        reason:
          "Refresh package-lock.json so react resolves to the remediated version."
      },
      {
        changeType: "edit",
        path: "package.json",
        reason: "Update the react dependency declaration in package.json."
      }
    ],
    id: "pr:dependency-upgrade:react",
    labels: ["candidate-pr", "dependencies", "security", "high"],
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    rationale: "The change is bounded to one direct dependency and two root files.",
    readiness: "ready",
    relatedFindingIds: ["dependency:react:1"],
    riskLevel: "low",
    rollbackNote: "Restore the previous react version entries if the upgrade regresses.",
    severity: "high",
    summary: "Upgrade react and refresh the root npm dependency files.",
    testPlan: [
      "Install dependencies for the root workspace.",
      "Run the repository validation commands that cover react usage."
    ],
    title: "Upgrade react and refresh dependency locks",
    ...overrides
  };
}

function createDependencyPRPatchPlan(
  overrides: Partial<PRPatchPlan> = {}
): PRPatchPlan {
  return {
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    id: "patch-plan:pr:dependency-upgrade:react",
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    patchPlan: {
      constraints: [
        "Keep the change scoped to root package.json and package-lock.json.",
        "Avoid unrelated dependency churn."
      ],
      filesPlanned: [
        {
          changeType: "edit",
          path: "package-lock.json",
          reason:
            "Refresh package-lock.json so react resolves to the remediated version."
        },
        {
          changeType: "edit",
          path: "package.json",
          reason: "Update the react dependency declaration in package.json."
        }
      ],
      patchStrategy:
        "Update the direct dependency declaration and replace only the matching root lockfile entries.",
      requiredHumanReview: [
        "Confirm the resolved lock metadata matches the intended react release."
      ],
      requiredValidationSteps: [
        "Install dependencies for the root workspace.",
        "Run the repository validation commands that cover react usage."
      ]
    },
    patchWarnings: [],
    patchability: "patch_candidate",
    prCandidateId: "pr:dependency-upgrade:react",
    readiness: "ready",
    relatedFindingIds: ["dependency:react:1"],
    riskLevel: "low",
    severity: "high",
    title: "Upgrade react and refresh dependency locks",
    validationNotes: ["Validation has not been executed in this step."],
    validationStatus: "ready",
    ...overrides
  };
}

function createAnalysisContext(
  overrides: Partial<AnalyzeRepoResponse> = {}
): AnalyzeRepoResponse {
  return {
    codeReviewFindingSummary: {
      findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      isPartial: false, reviewedFileCount: 0, totalFindings: 0
    },
    dependencyFindingSummary: {
      findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      isPartial: false, totalFindings: 0, vulnerableDirectCount: 0, vulnerableTransitiveCount: 0
    },
    dependencySnapshot: {
      dependencies: [], filesParsed: [], filesSkipped: [], isPartial: false, parseWarningDetails: [], parseWarnings: [],
      summary: { byEcosystem: [], directDependencies: 0, parsedFileCount: 0, skippedFileCount: 0, totalDependencies: 0, transitiveDependencies: 0 }
    },
    detectedFiles: { lockfiles: [], manifests: [], signals: [] },
    ecosystems: [],
    fetchedAt: "2026-04-08T00:00:00.000Z",
    isPartial: false,
    issueCandidateSummary: {
      bySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      byType: [], totalCandidates: 0
    },
    prCandidateSummary: {
      byReadiness: [], byRiskLevel: [], byType: [], totalCandidates: 0
    },
    prPatchPlanSummary: { byPatchability: [], byValidationStatus: [], totalPatchCandidates: 0, totalPlans: 0 },
    reviewCoverage: {
      candidateFileCount: 0, isPartial: false, reviewedFileCount: 0, selectedFileCount: 0,
      selectedPaths: [], skippedFileCount: 0, skippedPaths: [], strategy: "targeted"
    },
    treeSummary: { samplePaths: [], totalDirectories: 0, totalFiles: 0, truncated: false },
    warningDetails: [],
    warnings: [],
    codeReviewFindings: [createWorkflowFinding()],
    dependencyFindings: [],
    issueCandidates: [createIssueCandidate()],
    prCandidates: [createPRCandidate()],
    prPatchPlans: [createPRPatchPlan()],
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
    },
    ...overrides
  };
}

function createDependencyAnalysisContext(
  overrides: Partial<AnalyzeRepoResponse> = {}
): AnalyzeRepoResponse {
  return {
    codeReviewFindingSummary: {
      findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      isPartial: false, reviewedFileCount: 0, totalFindings: 0
    },
    dependencyFindingSummary: {
      findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      isPartial: false, totalFindings: 0, vulnerableDirectCount: 0, vulnerableTransitiveCount: 0
    },
    dependencySnapshot: {
      dependencies: [], filesParsed: [], filesSkipped: [], isPartial: false, parseWarningDetails: [], parseWarnings: [],
      summary: { byEcosystem: [], directDependencies: 0, parsedFileCount: 0, skippedFileCount: 0, totalDependencies: 0, transitiveDependencies: 0 }
    },
    detectedFiles: { lockfiles: [], manifests: [], signals: [] },
    ecosystems: [],
    fetchedAt: "2026-04-08T00:00:00.000Z",
    isPartial: false,
    issueCandidateSummary: {
      bySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      byType: [], totalCandidates: 0
    },
    prCandidateSummary: {
      byReadiness: [], byRiskLevel: [], byType: [], totalCandidates: 0
    },
    prPatchPlanSummary: { byPatchability: [], byValidationStatus: [], totalPatchCandidates: 0, totalPlans: 0 },
    reviewCoverage: {
      candidateFileCount: 0, isPartial: false, reviewedFileCount: 0, selectedFileCount: 0,
      selectedPaths: [], skippedFileCount: 0, skippedPaths: [], strategy: "targeted"
    },
    treeSummary: { samplePaths: [], totalDirectories: 0, totalFiles: 0, truncated: false },
    warningDetails: [],
    warnings: [],
    codeReviewFindings: [],
    dependencyFindings: [createDependencyFinding()],
    issueCandidates: [createDependencyIssueCandidate()],
    prCandidates: [createDependencyPRCandidate()],
    prPatchPlans: [createDependencyPRPatchPlan()],
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
    },
    ...overrides
  };
}

function createPackageJsonContent(specifier = "^1.0.0"): string {
  return `${JSON.stringify(
    {
      dependencies: {
        react: specifier
      }
    },
    null,
    2
  )}\n`;
}

function createPackageLockContent(lockfileVersion = 3): string {
  return `${JSON.stringify(
    {
      dependencies: {
        react: {
          integrity: "sha512-old",
          resolved: "https://registry.npmjs.org/react/-/react-1.0.0.tgz",
          version: "1.0.0"
        }
      },
      lockfileVersion,
      name: "sample",
      packages: {
        "": {
          dependencies: {
            react: "^1.0.0"
          }
        },
        "node_modules/other/node_modules/react": {
          dependencies: {
            "loose-envify": "^1.4.0"
          },
          integrity: "sha512-new",
          name: "react",
          resolved: "https://registry.npmjs.org/react/-/react-2.0.0.tgz",
          version: "2.0.0"
        },
        "node_modules/react": {
          integrity: "sha512-old",
          name: "react",
          resolved: "https://registry.npmjs.org/react/-/react-1.0.0.tgz",
          version: "1.0.0"
        }
      }
    },
    null,
    2
  )}\n`;
}

type TestApp = {
  app: express.Express;
  saveRun: (analysis: AnalyzeRepoResponse) => string;
};

type StoredPlanState = {
  actions: ExecutionActionPlan[];
  detail: ExecutionPlanDetailResponse;
  events: ExecutionPlanEventsResponse["events"];
  executionSummary: ExecutionPlanResponse["summary"] | null;
};

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createTestApp(
  dependencies: Parameters<typeof createExecutionRouter>[0]
): TestApp {
  const app = express();
  const runs = new Map<string, SavedAnalysisRun>();
  const plans = new Map<string, StoredPlanState>();
  let executionCounter = 0;

  app.use(express.json());
  app.use(
    "/api",
    createExecutionRouter(dependencies, {
      planRepository: {
        async claimExecution(input) {
          const state = plans.get(input.planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          if (
            state.detail.status === "planned" &&
            new Date(state.detail.expiresAt) < new Date()
          ) {
            state.detail = {
              ...state.detail,
              status: "expired"
            };
            state.events.push({
              actionId: null,
              actorUserId: input.actorUserId,
              createdAt: new Date().toISOString(),
              details: {
                previousStatus: "planned",
                status: "expired"
              },
              eventId: `evt_${Date.now()}`,
              eventType: "plan_expired",
              executionId: null,
              planId: input.planId,
              repositoryFullName: state.detail.repository.fullName
            });
          }

          if (state.detail.status !== "planned") {
            throw new PersistenceError(
              "conflict",
              "Plan is already executing or no longer active."
            );
          }

          executionCounter += 1;
          const executionId = `exec_test_${executionCounter}`;
          state.detail = {
            ...state.detail,
            approval: {
              ...state.detail.approval,
              notes: ["Explicit approval verified via token."],
              status: "granted",
              verifiedAt: new Date().toISOString()
            },
            executionId,
            startedAt: new Date().toISOString(),
            status: "executing"
          };
          state.events.push({
            actionId: null,
            actorUserId: input.actorUserId,
            createdAt: new Date().toISOString(),
            details: {
              executionId,
              status: "executing"
            },
            eventId: `evt_${Date.now()}_${executionCounter}`,
            eventType: "execution_started",
            executionId,
            planId: input.planId,
            repositoryFullName: state.detail.repository.fullName
          });

          return {
            actions: state.actions,
            analysisRunId: state.detail.analysisRunId,
            executionId,
            planHash: state.detail.planHash,
            planId: state.detail.planId,
            repositoryFullName: state.detail.repository.fullName,
            selectedIssueCandidateIds: state.detail.selectedIssueCandidateIds,
            selectedPRCandidateIds: state.detail.selectedPRCandidateIds
          };
        },
        async finalizeExecution(input) {
          const state = plans.get(input.planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          state.executionSummary = input.result.summary;
          state.detail = {
            ...state.detail,
            completedAt:
              input.result.status === "completed"
                ? input.result.completedAt
                : state.detail.completedAt,
            executionId: input.executionId,
            executionResultStatus:
              input.result.status === "completed" || input.result.status === "failed"
                ? input.result.status
                : null,
            executionSummary: input.result.summary,
            failedAt:
              input.result.status === "failed"
                ? input.result.completedAt
                : state.detail.failedAt,
            status: input.result.status === "completed" ? "completed" : "failed"
          };
          state.events.push({
            actionId: null,
            actorUserId: input.actorUserId,
            createdAt: input.result.completedAt,
            details: {
              errors: input.result.errors,
              status: state.detail.status,
              warnings: input.result.warnings
            },
            eventId: `evt_${Date.now()}_${executionCounter}_done`,
            eventType:
              input.result.status === "completed"
                ? "execution_completed"
                : "execution_failed",
            executionId: input.executionId,
            planId: input.planId,
            repositoryFullName: input.repositoryFullName
          });
        },
        async getPlanDetail(planId) {
          const state = plans.get(planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          if (
            state.detail.status === "planned" &&
            new Date(state.detail.expiresAt) < new Date()
          ) {
            state.detail = {
              ...state.detail,
              status: "expired"
            };
          }

          return state.detail;
        },
        async getPlanEvents(planId) {
          const state = plans.get(planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          return {
            events: state.events,
            planId
          };
        },
        async markExecutionFailure(input) {
          const state = plans.get(input.planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          state.detail = {
            ...state.detail,
            executionId: input.executionId,
            failedAt: new Date().toISOString(),
            status: "failed"
          };
        },
        async recordActionCompleted(input) {
          const state = plans.get(input.planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          state.actions = state.actions.map((action) =>
            action.id === input.action.id ? input.action : action
          );
          state.detail = {
            ...state.detail,
            actions: state.detail.actions.map((action) =>
              action.id === input.action.id
                ? {
                    ...input.action,
                    completedAt: new Date().toISOString(),
                    startedAt:
                      state.detail.actions.find((candidate) => candidate.id === action.id)
                        ?.startedAt ?? null
                  }
                : action
            )
          };
          state.events.push({
            actionId: input.action.id,
            actorUserId: input.actorUserId,
            createdAt: new Date().toISOString(),
            details: {
              actionType: input.action.actionType,
              errorMessage: input.action.errorMessage,
              succeeded: input.action.succeeded
            },
            eventId: `evt_${Date.now()}_${input.action.id}_done`,
            eventType: input.action.succeeded ? "action_succeeded" : "action_failed",
            executionId: input.executionId,
            planId: input.planId,
            repositoryFullName: input.repositoryFullName
          });
        },
        async recordActionStarted(input) {
          const state = plans.get(input.planId);

          if (!state) {
            throw new PersistenceError("not_found", "Plan not found.");
          }

          state.detail = {
            ...state.detail,
            actions: state.detail.actions.map((action) =>
              action.id === input.action.id
                ? {
                    ...input.action,
                    startedAt: new Date().toISOString(),
                    completedAt: action.completedAt
                  }
                : action
            )
          };
          state.events.push({
            actionId: input.action.id,
            actorUserId: input.actorUserId,
            createdAt: new Date().toISOString(),
            details: {
              actionType: input.action.actionType,
              eligibility: input.action.eligibility
            },
            eventId: `evt_${Date.now()}_${input.action.id}_start`,
            eventType: "action_started",
            executionId: input.executionId,
            planId: input.planId,
            repositoryFullName: input.repositoryFullName
          });
        },
        async savePlan(input) {
          const detail: ExecutionPlanDetailResponse = {
            actions: input.actions.map((action) => ({
              ...action,
              completedAt: null,
              startedAt: null
            })),
            actorUserId: input.actorUserId,
            analysisRunId: input.analysisRunId,
            approval: {
              confirmationText: input.approval.confirmationText,
              notes: ["Awaiting explicit execution approval."],
              required: input.approval.required,
              status: "required",
              verifiedAt: null
            },
            cancelledAt: null,
            completedAt: null,
            createdAt: input.createdAt,
            executionId: null,
            executionResultStatus: null,
            executionSummary: null,
            expiresAt: input.expiresAt,
            failedAt: null,
            planHash: input.planHash,
            planId: input.planId,
            repository: input.repository,
            selectedIssueCandidateIds: input.selectedIssueCandidateIds,
            selectedPRCandidateIds: input.selectedPRCandidateIds,
            startedAt: null,
            status: "planned"
          };

          plans.set(input.planId, {
            actions: input.actions,
            detail,
            events: [
              {
                actionId: null,
                actorUserId: input.actorUserId,
                createdAt: input.createdAt,
                details: {
                  selectedIssueCandidateIds: input.selectedIssueCandidateIds,
                  selectedPRCandidateIds: input.selectedPRCandidateIds,
                  status: "planned"
                },
                eventId: `evt_${input.planId}_created`,
                eventType: "plan_created",
                executionId: null,
                planId: input.planId,
                repositoryFullName: input.repository.fullName
              }
            ],
            executionSummary: null
          });
        }
      },
      runRepository: {
        async getRun(runId) {
          const run = runs.get(runId);

          if (!run) {
            throw new PersistenceError("not_found", "Saved analysis run was not found.");
          }

          return {
            run,
            summary: createAnalysisRunSummary(run)
          };
        }
      }
    })
  );

  return {
    app,
    saveRun(analysis) {
      const runId = `test_run_${Date.now()}_${runs.size + 1}`;
      const run: SavedAnalysisRun = {
        analysis,
        createdAt: new Date().toISOString(),
        id: runId,
        label: "Test"
      };
      runs.set(runId, run);
      return runId;
    }
  };
}

async function runTwoPhaseExecution(
  testApp: TestApp,
  analysisData: AnalyzeRepoResponse,
  selectedIssues: string[],
  selectedPRs: string[]
) {
  const runId = testApp.saveRun(analysisData);

  const planRes = await request(testApp.app)
    .post("/api/execution/plan")
    .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
    .send({
      analysisRunId: runId,
      selectedIssueCandidateIds: selectedIssues,
      selectedPRCandidateIds: selectedPRs
    });

  if (planRes.status !== 200) {
    return planRes;
  }

  const execRes = await request(testApp.app)
    .post("/api/execution/execute")
    .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
    .send({
      planId: planRes.body.planId,
      planHash: planRes.body.planHash,
      approvalToken: planRes.body.approvalToken,
      confirm: true,
      confirmationText: "I approve this GitHub write-back plan."
    });

  return execRes;
}

describe("POST /api/execution/plan", () => {
  it("returns a dry-run plan without side effects", async () => {
    const readClient = {
      fetchRepositoryFileText: vi.fn()
    };
    const writeClient = {
      createBranchFromDefaultBranch: vi.fn(),
      commitFileChanges: vi.fn(),
      createIssue: vi.fn(),
      openPullRequest: vi.fn()
    };
    const testApp = createTestApp({
      readClient,
      writeClient
    });
    const runId = testApp.saveRun(createAnalysisContext());

    const response = await request(testApp.app)
      .post("/api/execution/plan")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        analysisRunId: runId,
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      planId: expect.stringMatching(/^plan_/),
      planHash: expect.stringMatching(/^sha256:/),
      approvalToken: expect.any(String),
      summary: expect.objectContaining({
        totalSelections: 2
      })
    });
    expect(readClient.fetchRepositoryFileText).not.toHaveBeenCalled();
    expect(writeClient.createIssue).not.toHaveBeenCalled();
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
    expect(writeClient.commitFileChanges).not.toHaveBeenCalled();
    expect(writeClient.openPullRequest).not.toHaveBeenCalled();
    expect(ExecutionPlanResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("reopens persisted plan detail and ordered audit events", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        createIssue: vi.fn(),
        openPullRequest: vi.fn()
      }
    });
    const runId = testApp.saveRun(createAnalysisContext());

    const planResponse = await request(testApp.app)
      .post("/api/execution/plan")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        analysisRunId: runId,
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: []
      });

    expect(planResponse.status).toBe(200);

    const detailResponse = await request(testApp.app)
      .get(`/api/execution/plans/${planResponse.body.planId}`)
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    const eventsResponse = await request(testApp.app)
      .get(`/api/execution/plans/${planResponse.body.planId}/events`)
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toMatchObject({
      analysisRunId: runId,
      planId: planResponse.body.planId,
      status: "planned"
    });
    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.events).toEqual([
      expect.objectContaining({
        eventType: "plan_created",
        planId: planResponse.body.planId
      })
    ]);
  });

  it("executes an approved issue creation request", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createIssue: vi.fn().mockResolvedValue({
          issueNumber: 8,
          issueUrl: "https://github.com/openai/openai-node/issues/8"
        }),
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        openPullRequest: vi.fn()
      }
    });

    const response = await runTwoPhaseExecution(
      testApp,
      createAnalysisContext(),
      ["issue:workflow-hardening:.github/workflows/ci.yml"],
      []
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      approvalRequired: true,
      approvalStatus: "granted",
      mode: "execute_approved",
      status: "completed"
    });
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_issue",
          attempted: true,
          blocked: false,
          issueNumber: 8,
          issueUrl: "https://github.com/openai/openai-node/issues/8",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved workflow PR creation request", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi
          .fn()
          .mockResolvedValue(
            "name: CI\non:\n  push:\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n"
          )
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn().mockResolvedValue({
          baseCommitSha: "base-sha",
          branchName: "repo-guardian/test-branch"
        }),
        commitFileChanges: vi.fn().mockResolvedValue({
          branchName: "repo-guardian/test-branch",
          commitSha: "commit-sha"
        }),
        openPullRequest: vi.fn().mockResolvedValue({
          pullRequestNumber: 19,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/19"
        })
      }
    });

    const response = await runTwoPhaseExecution(
      testApp,
      createAnalysisContext(),
      [],
      ["pr:workflow-hardening:.github/workflows/ci.yml"]
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_branch",
          attempted: true,
          branchName: "repo-guardian/test-branch",
          commitSha: "base-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/test-branch",
          commitSha: "commit-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/test-branch",
          pullRequestNumber: 19,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved workflow PR creation request for explicit contents: write permissions", async () => {
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/contents-write-branch",
      commitSha: "commit-sha-contents"
    });
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(
          [
            "name: CI",
            "on:",
            "  push:",
            "permissions:",
            "  contents: write",
            "jobs:",
            "  test:",
            "    runs-on: ubuntu-latest"
          ].join("\n")
        )
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn().mockResolvedValue({
          baseCommitSha: "base-sha-contents",
          branchName: "repo-guardian/contents-write-branch"
        }),
        commitFileChanges,
        openPullRequest: vi.fn().mockResolvedValue({
          pullRequestNumber: 20,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/20"
        })
      }
    });

    const response = await runTwoPhaseExecution(
      testApp,
      createAnalysisContext(),
      [],
      ["pr:workflow-hardening:.github/workflows/ci.yml"]
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(commitFileChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "repo-guardian/contents-write-branch",
        fileChanges: [
          expect.objectContaining({
            path: ".github/workflows/ci.yml",
            content: expect.stringContaining("contents: read")
          })
        ]
      })
    );
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/contents-write-branch",
          commitSha: "commit-sha-contents",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/contents-write-branch",
          pullRequestNumber: 20,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/20",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved workflow PR creation request for inline permissions: { contents: write }", async () => {
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/inline-contents-write-branch",
      commitSha: "commit-sha-inline"
    });
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn().mockResolvedValue(
          [
            "name: CI",
            "on:",
            "  push:",
            "permissions: { contents: write }",
            "jobs:",
            "  test:",
            "    runs-on: ubuntu-latest"
          ].join("\n")
        )
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn().mockResolvedValue({
          baseCommitSha: "base-sha-inline",
          branchName: "repo-guardian/inline-contents-write-branch"
        }),
        commitFileChanges,
        openPullRequest: vi.fn().mockResolvedValue({
          pullRequestNumber: 21,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/21"
        })
      }
    });

    const response = await runTwoPhaseExecution(
      testApp,
      createAnalysisContext(),
      [],
      ["pr:workflow-hardening:.github/workflows/ci.yml"]
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(commitFileChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "repo-guardian/inline-contents-write-branch",
        fileChanges: [
          expect.objectContaining({
            path: ".github/workflows/ci.yml",
            content: expect.stringContaining("permissions: { contents: read }")
          })
        ]
      })
    );
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/inline-contents-write-branch",
          commitSha: "commit-sha-inline",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/inline-contents-write-branch",
          pullRequestNumber: 21,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/21",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved dependency PR creation request", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi
          .fn()
          .mockResolvedValueOnce(createPackageJsonContent("^1.0.0"))
          .mockResolvedValueOnce(createPackageLockContent())
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn().mockResolvedValue({
          baseCommitSha: "base-sha",
          branchName: "repo-guardian/dependency-branch"
        }),
        commitFileChanges: vi.fn().mockResolvedValue({
          branchName: "repo-guardian/dependency-branch",
          commitSha: "commit-sha"
        }),
        openPullRequest: vi.fn().mockResolvedValue({
          pullRequestNumber: 24,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/24"
        })
      }
    });

    const response = await runTwoPhaseExecution(
      testApp,
      createDependencyAnalysisContext(),
      [],
      ["pr:dependency-upgrade:react"]
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/dependency-branch",
          commitSha: "commit-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/dependency-branch",
          pullRequestNumber: 24,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/24",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved dependency PR creation request for package-lock.json v2", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi
          .fn()
          .mockResolvedValueOnce(createPackageJsonContent("^1.0.0"))
          .mockResolvedValueOnce(createPackageLockContent(2))
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn().mockResolvedValue({
          baseCommitSha: "base-sha-v2",
          branchName: "repo-guardian/dependency-branch-v2"
        }),
        commitFileChanges: vi.fn().mockResolvedValue({
          branchName: "repo-guardian/dependency-branch-v2",
          commitSha: "commit-sha-v2"
        }),
        openPullRequest: vi.fn().mockResolvedValue({
          pullRequestNumber: 25,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/25"
        })
      }
    });

    const response = await runTwoPhaseExecution(
      testApp,
      createDependencyAnalysisContext(),
      [],
      ["pr:dependency-upgrade:react"]
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/dependency-branch-v2",
          commitSha: "commit-sha-v2",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/dependency-branch-v2",
          pullRequestNumber: 25,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/25",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("returns a blocked result when approval is missing", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        openPullRequest: vi.fn()
      }
    });

    const runId = testApp.saveRun(createAnalysisContext());

    const planRes = await request(testApp.app)
      .post("/api/execution/plan")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        analysisRunId: runId,
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
      });

    const response = await request(testApp.app)
      .post("/api/execution/execute")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        planId: planRes.body.planId,
        planHash: planRes.body.planHash,
        approvalToken: planRes.body.approvalToken,
        confirm: false, // Explicitly false
        confirmationText: "I approve this GitHub write-back plan."
      });

    expect(response.status).toBe(400); // Zod validation fails for confirm: false
    expect(response.body.error).toMatch(/Invalid literal value|Required/);
  });

  it("returns 400 for an invalid execution request", async () => {
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        openPullRequest: vi.fn()
      }
    });

    const response = await request(testApp.app)
      .post("/api/execution/plan")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        analysisRunId: "", // Missing or invalid
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: []
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it("rejects duplicate execution attempts for the same approved plan", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      issueNumber: 42,
      issueUrl: "https://github.com/openai/openai-node/issues/42"
    });
    const testApp = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        createIssue,
        openPullRequest: vi.fn()
      }
    });
    const runId = testApp.saveRun(createAnalysisContext());

    const planResponse = await request(testApp.app)
      .post("/api/execution/plan")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        analysisRunId: runId,
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: []
      });

    const payload = {
      approvalToken: planResponse.body.approvalToken,
      confirm: true as const,
      confirmationText: "I approve this GitHub write-back plan.",
      planHash: planResponse.body.planHash,
      planId: planResponse.body.planId
    };
    const [first, second] = await Promise.all([
      request(testApp.app)
        .post("/api/execution/execute")
        .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
        .send(payload),
      request(testApp.app)
        .post("/api/execution/execute")
        .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
        .send(payload)
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(createIssue).toHaveBeenCalledTimes(1);
  });
});
