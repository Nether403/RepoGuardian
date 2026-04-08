import { describe, expect, it } from "vitest";
import type {
  AnalyzeRepoResponse,
  CodeReviewFinding,
  DependencyFinding,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";
import {
  buildAnchorId,
  buildGuardianGraph,
  buildTraceabilityMapSummary,
  buildTraceabilityViewModel,
  filterPatchPlans,
  formatPatchability,
  getCandidateTypeFilterOptions,
  getConfidenceTone,
  getPatchPlanAnchorId,
  getSeverityTone,
  getWriteBackEligibility,
  selectGuardianGraphNode,
  summarizeWriteBackReadiness
} from "../index.js";

const dependencyFinding: DependencyFinding = {
  advisoryId: "GHSA-test",
  advisorySource: "OSV",
  affectedRange: ">=1.0.0 <1.0.1",
  candidateIssue: true,
  candidatePr: true,
  category: "dependency-vulnerability",
  confidence: "high",
  dependencyType: "production",
  evidence: [],
  id: "dependency:react",
  installedVersion: "1.0.0",
  isDirect: true,
  lineSpans: [],
  packageName: "react",
  paths: ["package.json", "package-lock.json"],
  recommendedAction: "Upgrade react.",
  referenceUrls: ["https://osv.dev/vulnerability/GHSA-test"],
  remediationType: "upgrade",
  remediationVersion: "1.0.1",
  severity: "high",
  sourceType: "dependency",
  summary: "react is vulnerable",
  title: "react advisory"
};

const codeFinding: CodeReviewFinding = {
  candidateIssue: true,
  candidatePr: true,
  category: "workflow-hardening",
  confidence: "medium",
  evidence: [],
  id: "review:workflow",
  lineSpans: [],
  paths: [".github/workflows/ci.yml"],
  recommendedAction: "Declare explicit workflow permissions.",
  severity: "low",
  sourceType: "workflow",
  summary: "Workflow permissions are implicit.",
  title: "Workflow permissions are implicit"
};

const dependencyIssueCandidate: IssueCandidate = {
  acceptanceCriteria: ["Upgrade react."],
  affectedPackages: ["react"],
  affectedPaths: ["package.json", "package-lock.json"],
  candidateType: "dependency-upgrade",
  confidence: "high",
  id: "issue:dependency:react",
  labels: ["dependencies"],
  relatedFindingIds: ["dependency:react"],
  scope: "package",
  severity: "high",
  suggestedBody: "Upgrade react.",
  summary: "Upgrade react.",
  title: "Upgrade react",
  whyItMatters: "The dependency is vulnerable."
};

const workflowIssueCandidate: IssueCandidate = {
  ...dependencyIssueCandidate,
  acceptanceCriteria: ["Declare workflow permissions."],
  affectedPackages: [],
  affectedPaths: [".github/workflows/ci.yml"],
  candidateType: "workflow-hardening",
  confidence: "medium",
  id: "issue:workflow:permissions",
  labels: ["workflow"],
  relatedFindingIds: ["review:workflow"],
  scope: "workflow-file",
  severity: "low",
  suggestedBody: "Declare workflow permissions.",
  summary: "Harden workflow permissions.",
  title: "Harden workflow permissions",
  whyItMatters: "Explicit permissions reduce token scope."
};

const dependencyPRCandidate: PRCandidate = {
  affectedPackages: ["react"],
  affectedPaths: ["package.json", "package-lock.json"],
  candidateType: "dependency-upgrade",
  confidence: "high",
  expectedFileChanges: [
    {
      changeType: "edit",
      path: "package.json",
      reason: "Upgrade react."
    }
  ],
  id: "pr:dependency:react",
  labels: ["dependencies"],
  linkedIssueCandidateIds: ["issue:dependency:react"],
  rationale: "Upgrade react.",
  readiness: "ready",
  relatedFindingIds: ["dependency:react"],
  riskLevel: "low",
  rollbackNote: "Revert the dependency change.",
  severity: "high",
  summary: "Upgrade react.",
  testPlan: ["Run tests."],
  title: "Upgrade react"
};

const workflowPRCandidate: PRCandidate = {
  ...dependencyPRCandidate,
  affectedPackages: [],
  affectedPaths: [".github/workflows/ci.yml"],
  candidateType: "workflow-hardening",
  confidence: "medium",
  expectedFileChanges: [
    {
      changeType: "edit",
      path: ".github/workflows/ci.yml",
      reason: "Declare permissions."
    }
  ],
  id: "pr:workflow:permissions",
  labels: ["workflow"],
  linkedIssueCandidateIds: ["issue:workflow:permissions"],
  rationale: "Declare workflow permissions.",
  readiness: "ready_with_warnings",
  relatedFindingIds: ["review:workflow"],
  riskLevel: "medium",
  rollbackNote: "Revert the workflow change.",
  severity: "low",
  summary: "Harden workflow permissions.",
  testPlan: ["Run workflow lint."],
  title: "Harden workflow permissions"
};

const dependencyPatchPlan: PRPatchPlan = {
  affectedPackages: ["react"],
  affectedPaths: ["package.json", "package-lock.json"],
  candidateType: "dependency-upgrade",
  confidence: "high",
  id: "patch-plan:pr:dependency:react",
  linkedIssueCandidateIds: ["issue:dependency:react"],
  patchPlan: {
    constraints: ["No registry lookup."],
    filesPlanned: [
      {
        changeType: "edit",
        path: "package.json",
        reason: "Upgrade react."
      }
    ],
    patchStrategy: "Update manifest and lockfile.",
    requiredHumanReview: [],
    requiredValidationSteps: ["Run tests."]
  },
  patchWarnings: [],
  patchability: "patch_candidate",
  prCandidateId: "pr:dependency:react",
  readiness: "ready",
  relatedFindingIds: ["dependency:react"],
  riskLevel: "low",
  severity: "high",
  title: "Upgrade react",
  validationNotes: ["Ready."],
  validationStatus: "ready",
  writeBackEligibility: {
    approvalRequired: true,
    details: ["Existing lockfile metadata was found uniquely."],
    status: "executable",
    summary: "Eligible for deterministic dependency write-back."
  }
};

const workflowPatchPlan: PRPatchPlan = {
  ...dependencyPatchPlan,
  affectedPackages: [],
  affectedPaths: [".github/workflows/ci.yml"],
  candidateType: "workflow-hardening",
  confidence: "medium",
  id: "patch-plan:pr:workflow:permissions",
  linkedIssueCandidateIds: ["issue:workflow:permissions"],
  patchPlan: null,
  patchability: "patch_plan_only",
  prCandidateId: "pr:workflow:permissions",
  readiness: "ready_with_warnings",
  relatedFindingIds: ["review:workflow"],
  riskLevel: "medium",
  severity: "low",
  title: "Harden workflow permissions",
  validationNotes: ["Blocked."],
  validationStatus: "blocked",
  writeBackEligibility: {
    approvalRequired: true,
    details: ["Workflow hardening remains blocked in this fixture."],
    status: "blocked",
    summary: "Workflow hardening remains blocked in this fixture."
  }
};

const analysis: AnalyzeRepoResponse = {
  codeReviewFindingSummary: {
    findingsBySeverity: {
      critical: 0,
      high: 0,
      info: 0,
      low: 1,
      medium: 0
    },
    isPartial: false,
    reviewedFileCount: 1,
    totalFindings: 1
  },
  codeReviewFindings: [codeFinding],
  dependencyFindingSummary: {
    findingsBySeverity: {
      critical: 0,
      high: 1,
      info: 0,
      low: 0,
      medium: 0
    },
    isPartial: false,
    totalFindings: 1,
    vulnerableDirectCount: 1,
    vulnerableTransitiveCount: 0
  },
  dependencyFindings: [dependencyFinding],
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
  fetchedAt: "2026-04-06T11:30:00.000Z",
  isPartial: false,
  issueCandidateSummary: {
    bySeverity: {
      critical: 0,
      high: 1,
      info: 0,
      low: 1,
      medium: 0
    },
    byType: [],
    totalCandidates: 2
  },
  issueCandidates: [dependencyIssueCandidate, workflowIssueCandidate],
  prCandidateSummary: {
    byReadiness: [],
    byRiskLevel: [],
    byType: [],
    totalCandidates: 2
  },
  prCandidates: [dependencyPRCandidate, workflowPRCandidate],
  prPatchPlanSummary: {
    byPatchability: [],
    byValidationStatus: [],
    totalPlans: 2
  },
  prPatchPlans: [dependencyPatchPlan, workflowPatchPlan],
  repository: {
    canonicalUrl: "https://github.com/openai/openai-node",
    defaultBranch: "main",
    description: "SDK",
    forks: 1,
    fullName: "openai/openai-node",
    htmlUrl: "https://github.com/openai/openai-node",
    owner: "openai",
    primaryLanguage: "TypeScript",
    repo: "openai-node",
    stars: 2
  },
  reviewCoverage: {
    candidateFileCount: 1,
    isPartial: false,
    reviewedFileCount: 1,
    selectedFileCount: 1,
    selectedPaths: [".github/workflows/ci.yml"],
    skippedFileCount: 0,
    skippedPaths: [],
    strategy: "targeted"
  },
  treeSummary: {
    samplePaths: ["package.json"],
    totalDirectories: 1,
    totalFiles: 2,
    truncated: false
  },
  warningDetails: [],
  warnings: []
};

describe("analysis view model", () => {
  it("builds stable anchors for traceable entities", () => {
    expect(buildAnchorId("patch-plan", "patch-plan:PR/One")).toBe(
      "patch-plan-patch-plan-pr-one"
    );
    expect(getPatchPlanAnchorId("patch-plan:pr:dependency:react")).toBe(
      "patch-plan-patch-plan-pr-dependency-react"
    );
  });

  it("builds traceability from a scoped patch-plan set", () => {
    const traceability = buildTraceabilityViewModel(analysis, [
      dependencyPatchPlan
    ]);

    expect(traceability.patchPlanById.size).toBe(1);
    expect(traceability.referencedCandidates.map((candidate) => candidate.id)).toEqual([
      "pr:dependency:react"
    ]);
    expect(
      traceability.referencedIssueCandidates.map((candidate) => candidate.id)
    ).toEqual(["issue:dependency:react"]);
    expect(traceability.referencedFindings.map((finding) => finding.id)).toEqual([
      "dependency:react"
    ]);
    expect(traceability.patchPlansByFindingId.get("dependency:react")).toEqual([
      dependencyPatchPlan
    ]);
  });

  it("filters patch plans and recomputes traceability map counts", () => {
    const visiblePatchPlans = filterPatchPlans({
      candidateTypeFilter: "workflow-hardening",
      eligibilityFilter: "blocked",
      patchPlans: analysis.prPatchPlans
    });
    const traceability = buildTraceabilityViewModel(analysis, visiblePatchPlans);

    expect(visiblePatchPlans).toEqual([workflowPatchPlan]);
    expect(buildTraceabilityMapSummary(traceability)).toEqual([
      {
        count: 1,
        href: "#traceability-patch-plans",
        label: "Patch plans"
      },
      {
        count: 1,
        href: "#traceability-pr-candidates",
        label: "PR candidates"
      },
      {
        count: 1,
        href: "#traceability-issue-candidates",
        label: "Issue candidates"
      },
      {
        count: 1,
        href: "#traceability-findings",
        label: "Findings"
      }
    ]);
  });

  it("summarizes readiness and exposes candidate type filter options", () => {
    expect(summarizeWriteBackReadiness(analysis.prPatchPlans)).toEqual({
      blocked: 1,
      executable: 1
    });
    expect(getCandidateTypeFilterOptions(analysis.prPatchPlans)).toEqual([
      "dependency-upgrade",
      "workflow-hardening"
    ]);
  });

  it("provides compatibility fallback eligibility for older payloads", () => {
    const planWithoutEligibility: PRPatchPlan = {
      ...dependencyPatchPlan,
      writeBackEligibility: undefined
    };

    expect(getWriteBackEligibility(planWithoutEligibility)).toMatchObject({
      approvalRequired: true,
      status: "blocked"
    });
  });

  it("formats and tones representative statuses", () => {
    expect(formatPatchability("patch_candidate")).toBe("patch candidate");
    expect(getSeverityTone("high")).toBe("warning");
    expect(getConfidenceTone("high")).toBe("active");
  });

  it("builds a deterministic guardian graph from analysis entities", () => {
    const graph = buildGuardianGraph(analysis);
    const workflowFindingNode = graph.nodes.find(
      (node) => node.id === "code-finding:review:workflow"
    );
    const eligibleForEdge = graph.edges.find(
      (edge) =>
        edge.source === "pr-candidate:pr:workflow:permissions" &&
        edge.target === `patch-plan:${workflowPatchPlan.id}` &&
        edge.type === "eligible-for"
    );

    expect(graph.nodes.map((node) => node.id)).toContain(
      "repository:openai/openai-node"
    );
    expect(graph.nodes.map((node) => node.id)).toContain(
      "dependency-finding:dependency:react"
    );
    expect(graph.nodes.map((node) => node.id)).toContain(
      "patch-plan:patch-plan:pr:dependency:react"
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "dependency-finding:dependency:react",
        target: "issue-candidate:issue:dependency:react",
        type: "grouped-into"
      })
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "pr-candidate:pr:workflow:permissions",
        target: `patch-plan:${workflowPatchPlan.id}`,
        type: "eligible-for"
      })
    );
    expect(graph.summary).toMatchObject({
      blockedPatchPlans: 1,
      codeFindingCount: 1,
      dependencyFindingCount: 1,
      executablePatchPlans: 1,
      highSeverityFindingCount: 1
    });
    expect(workflowFindingNode?.writeBackHint).toEqual({
      status: "blocked",
      summary: "Workflow hardening remains blocked in this fixture."
    });
    expect(eligibleForEdge?.writeBackHint).toEqual({
      status: "blocked",
      summary: "Workflow hardening remains blocked in this fixture."
    });
    expect(workflowFindingNode?.tooltip).toContain(
      "code finding: Workflow permissions are implicit"
    );
    expect(eligibleForEdge?.tooltip).toContain("pr candidate eligible for patch plan");
  });

  it("surfaces matched workflow patterns in graph selections", () => {
    const workflowExecutableAnalysis: AnalyzeRepoResponse = {
      ...analysis,
      prPatchPlans: analysis.prPatchPlans.map((plan) =>
        plan.id === workflowPatchPlan.id
          ? {
              ...plan,
              writeBackEligibility: {
                approvalRequired: true,
                details: [
                  "Approval is still required before Repo Guardian performs any GitHub write-back.",
                  "The PR candidate is patch-capable for the current workflow-hardening write-back slice.",
                  "Matched deterministic workflow permission patterns: inline permissions: { contents: write }."
                ],
                matchedPatterns: ["inline permissions: { contents: write }"],
                status: "executable",
                summary: "Eligible for approved workflow write-back."
              }
            }
          : plan
      )
    };
    const graph = buildGuardianGraph(workflowExecutableAnalysis);
    const codeFindingSelection = selectGuardianGraphNode(graph, "code-finding:review:workflow");
    const patchPlanSelection = selectGuardianGraphNode(
      graph,
      `patch-plan:${workflowPatchPlan.id}`
    );
    const eligibleForEdge = graph.edges.find(
      (edge) =>
        edge.source === "pr-candidate:pr:workflow:permissions" &&
        edge.target === `patch-plan:${workflowPatchPlan.id}` &&
        edge.type === "eligible-for"
    );

    expect(codeFindingSelection?.node.matchedPatterns).toEqual([
      "inline permissions: { contents: write }"
    ]);
    expect(codeFindingSelection?.node.writeBackHint).toEqual({
      status: "executable",
      summary: "Eligible for approved workflow write-back."
    });
    expect(patchPlanSelection?.node.matchedPatterns).toEqual([
      "inline permissions: { contents: write }"
    ]);
    expect(patchPlanSelection?.node.writeBackHint).toEqual({
      status: "executable",
      summary: "Eligible for approved workflow write-back."
    });
    expect(eligibleForEdge?.writeBackHint).toEqual({
      status: "executable",
      summary: "Eligible for approved workflow write-back."
    });
    expect(patchPlanSelection?.node.tooltip).toContain(
      "Matched patterns: inline permissions: { contents: write }"
    );
  });

  it("selects a graph node with connected remediation context", () => {
    const graph = buildGuardianGraph(analysis);
    const selection = selectGuardianGraphNode(
      graph,
      "dependency-finding:dependency:react"
    );

    expect(selection?.node.title).toBe("react advisory");
    expect(selection?.connectedNodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "issue-candidate:issue:dependency:react",
        "pr-candidate:pr:dependency:react"
      ])
    );
    expect(selection?.node.details).toEqual(
      expect.arrayContaining([
        "Linked issues: 1",
        "Linked PRs: 1",
        "Upgrade react: executable - Eligible for deterministic dependency write-back."
      ])
    );
  });
});
