import type {
  AnalyzeRepoResponse,
  CodeReviewFinding,
  DependencyFinding,
  FindingSeverity,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";
import {
  getFindingAnchorId,
  getIssueCandidateAnchorId,
  getPatchPlanAnchorId,
  getPRCandidateAnchorId
} from "./anchors.js";
import { ecosystemLabels, prCandidateTypeLabels, signalLabels } from "./labels.js";
import { getWriteBackEligibility } from "./traceability.js";
import type {
  GuardianGraphEdge,
  GuardianGraphEdgeType,
  GuardianGraphModel,
  GuardianGraphNode,
  GuardianGraphNodeType,
  GuardianGraphSelection
} from "./graph-types.js";

function graphNodeId(type: GuardianGraphNodeType, entityId: string): string {
  return `${type}:${entityId}`;
}

function graphEdgeId(
  type: GuardianGraphEdgeType,
  source: string,
  target: string
): string {
  return `${type}:${source}->${target}`;
}

function createEdge(input: {
  label: string;
  source: string;
  target: string;
  type: GuardianGraphEdgeType;
}): GuardianGraphEdge {
  return {
    id: graphEdgeId(input.type, input.source, input.target),
    label: input.label,
    source: input.source,
    target: input.target,
    type: input.type
  };
}

function addEdge(
  edges: GuardianGraphEdge[],
  edgeKeys: Set<string>,
  edge: GuardianGraphEdge
) {
  if (!edgeKeys.has(edge.id)) {
    edgeKeys.add(edge.id);
    edges.push(edge);
  }
}

function severityRank(severity: FindingSeverity): number {
  const ranks: Record<FindingSeverity, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1
  };

  return ranks[severity];
}

function isHighSeverity(severity: FindingSeverity): boolean {
  return severityRank(severity) >= severityRank("high");
}

function collectMatchedWorkflowPatterns(plans: PRPatchPlan[]): string[] {
  const seen = new Set<string>();
  const matchedPatterns: string[] = [];

  for (const plan of plans) {
    const eligibility = getWriteBackEligibility(plan);

    for (const pattern of eligibility.matchedPatterns ?? []) {
      if (!seen.has(pattern)) {
        seen.add(pattern);
        matchedPatterns.push(pattern);
      }
    }
  }

  return matchedPatterns;
}

function deriveWorkflowWriteBackHint(
  plans: PRPatchPlan[]
): GuardianGraphNode["writeBackHint"] | undefined {
  const workflowPlans = plans.filter(
    (plan) => plan.candidateType === "workflow-hardening"
  );

  if (workflowPlans.length !== 1) {
    return undefined;
  }

  const workflowPlan = workflowPlans[0];

  if (!workflowPlan) {
    return undefined;
  }

  const eligibility = getWriteBackEligibility(workflowPlan);

  return {
    status: eligibility.status,
    summary: eligibility.summary
  };
}

function createDependencyFindingNode(
  finding: DependencyFinding,
  analysis: AnalyzeRepoResponse
): GuardianGraphNode {
  const linkedIssues = analysis.issueCandidates.filter((candidate) =>
    candidate.relatedFindingIds.includes(finding.id)
  );
  const linkedPRs = analysis.prCandidates.filter((candidate) =>
    candidate.relatedFindingIds.includes(finding.id)
  );
  const linkedPatchPlans = analysis.prPatchPlans.filter((plan) =>
    plan.relatedFindingIds.includes(finding.id)
  );
  const patchEligibility = linkedPatchPlans.map((plan) => {
    const eligibility = getWriteBackEligibility(plan);

    return `${plan.title}: ${eligibility.status} - ${eligibility.summary}`;
  });

  return {
    anchorId: getFindingAnchorId(finding.id),
    badges: [
      finding.severity,
      finding.confidence,
      finding.dependencyType,
      finding.isDirect ? "direct" : "transitive"
    ],
    confidence: finding.confidence,
    details: [
      `Package: ${finding.packageName}`,
      `Installed version: ${finding.installedVersion ?? "unknown"}`,
      `Remediation: ${finding.remediationVersion ?? finding.remediationType}`,
      `Linked issues: ${linkedIssues.length}`,
      `Linked PRs: ${linkedPRs.length}`,
      ...patchEligibility
    ],
    entityId: finding.id,
    id: graphNodeId("dependency-finding", finding.id),
    label: finding.packageName,
    path: finding.paths[0],
    severity: finding.severity,
    summary: finding.summary,
    title: finding.title,
    type: "dependency-finding"
  };
}

function createCodeFindingNode(
  finding: CodeReviewFinding,
  analysis: AnalyzeRepoResponse
): GuardianGraphNode {
  const linkedIssues = analysis.issueCandidates.filter((candidate) =>
    candidate.relatedFindingIds.includes(finding.id)
  );
  const linkedPRs = analysis.prCandidates.filter((candidate) =>
    candidate.relatedFindingIds.includes(finding.id)
  );
  const linkedPatchPlans = analysis.prPatchPlans.filter((plan) =>
    plan.relatedFindingIds.includes(finding.id)
  );
  const patchEligibility = linkedPatchPlans.map((plan) => {
    const eligibility = getWriteBackEligibility(plan);

    return `${plan.title}: ${eligibility.status} - ${eligibility.summary}`;
  });
  const matchedPatterns = collectMatchedWorkflowPatterns(linkedPatchPlans);
  const writeBackHint = deriveWorkflowWriteBackHint(linkedPatchPlans);

  return {
    anchorId: getFindingAnchorId(finding.id),
    badges: [finding.severity, finding.confidence, finding.sourceType],
    confidence: finding.confidence,
    details: [
      `Paths: ${finding.paths.join(", ") || "none"}`,
      `Linked issues: ${linkedIssues.length}`,
      `Linked PRs: ${linkedPRs.length}`,
      ...patchEligibility
    ],
    entityId: finding.id,
    id: graphNodeId("code-finding", finding.id),
    label: finding.title,
    matchedPatterns: matchedPatterns.length > 0 ? matchedPatterns : undefined,
    path: finding.paths[0],
    severity: finding.severity,
    summary: finding.summary,
    title: finding.title,
    type: "code-finding",
    writeBackHint
  };
}

function createIssueCandidateNode(candidate: IssueCandidate): GuardianGraphNode {
  return {
    anchorId: getIssueCandidateAnchorId(candidate.id),
    badges: [candidate.severity, candidate.confidence, candidate.scope],
    confidence: candidate.confidence,
    details: [
      `Affected paths: ${candidate.affectedPaths.join(", ") || "none"}`,
      `Affected packages: ${candidate.affectedPackages.join(", ") || "none"}`,
      `Acceptance criteria: ${candidate.acceptanceCriteria.length}`
    ],
    entityId: candidate.id,
    id: graphNodeId("issue-candidate", candidate.id),
    label: candidate.title,
    severity: candidate.severity,
    summary: candidate.summary,
    title: candidate.title,
    type: "issue-candidate"
  };
}

function createPRCandidateNode(
  candidate: PRCandidate,
  analysis: AnalyzeRepoResponse
): GuardianGraphNode {
  const linkedPatchPlans = analysis.prPatchPlans.filter(
    (plan) => plan.prCandidateId === candidate.id
  );
  const matchedPatterns = collectMatchedWorkflowPatterns(linkedPatchPlans);
  const writeBackHint = deriveWorkflowWriteBackHint(linkedPatchPlans);

  return {
    anchorId: getPRCandidateAnchorId(candidate.id),
    badges: [
      prCandidateTypeLabels[candidate.candidateType],
      candidate.readiness,
      `${candidate.riskLevel} risk`
    ],
    confidence: candidate.confidence,
    details: [
      `Readiness: ${candidate.readiness}`,
      `Risk: ${candidate.riskLevel}`,
      `Expected file changes: ${candidate.expectedFileChanges.length}`,
      `Test steps: ${candidate.testPlan.length}`
    ],
    entityId: candidate.id,
    id: graphNodeId("pr-candidate", candidate.id),
    label: candidate.title,
    matchedPatterns: matchedPatterns.length > 0 ? matchedPatterns : undefined,
    severity: candidate.severity,
    summary: candidate.summary,
    title: candidate.title,
    type: "pr-candidate",
    writeBackHint
  };
}

function createPatchPlanNode(plan: PRPatchPlan): GuardianGraphNode {
  const eligibility = getWriteBackEligibility(plan);
  const matchedPatterns = eligibility.matchedPatterns ?? [];
  const writeBackHint =
    plan.candidateType === "workflow-hardening"
      ? {
          status: eligibility.status,
          summary: eligibility.summary
        }
      : undefined;

  return {
    anchorId: getPatchPlanAnchorId(plan.id),
    badges: [plan.patchability, plan.validationStatus, eligibility.status],
    confidence: plan.confidence,
    details: [
      `Patchability: ${plan.patchability}`,
      `Validation: ${plan.validationStatus}`,
      `Write-back: ${eligibility.status}`,
      ...eligibility.details
    ],
    eligibilityStatus: eligibility.status,
    entityId: plan.id,
    id: graphNodeId("patch-plan", plan.id),
    label: plan.title,
    matchedPatterns: matchedPatterns.length > 0 ? matchedPatterns : undefined,
    severity: plan.severity,
    summary: eligibility.summary,
    title: plan.title,
    type: "patch-plan",
    writeBackHint
  };
}

function findFileNodeId(path: string, filePathToNodeId: Map<string, string>): string | undefined {
  return filePathToNodeId.get(path);
}

export function buildGuardianGraph(analysis: AnalyzeRepoResponse): GuardianGraphModel {
  const nodes: GuardianGraphNode[] = [];
  const edges: GuardianGraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  const filePathToNodeId = new Map<string, string>();
  const repositoryNodeId = graphNodeId("repository", analysis.repository.fullName);

  function addNode(node: GuardianGraphNode) {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  }

  addNode({
    badges: [analysis.repository.defaultBranch],
    details: [
      `Default branch: ${analysis.repository.defaultBranch}`,
      `Primary language: ${analysis.repository.primaryLanguage ?? "not reported"}`,
      `Stars: ${analysis.repository.stars.toLocaleString()}`
    ],
    entityId: analysis.repository.fullName,
    id: repositoryNodeId,
    label: analysis.repository.fullName,
    summary:
      analysis.repository.description ??
      "GitHub did not provide a repository description.",
    title: analysis.repository.fullName,
    type: "repository"
  });

  for (const ecosystem of analysis.ecosystems) {
    const ecosystemNodeId = graphNodeId("ecosystem", ecosystem.ecosystem);

    addNode({
      badges: ecosystem.packageManagers,
      details: [
        `Package managers: ${ecosystem.packageManagers.join(", ") || "none"}`,
        `Manifests: ${ecosystem.manifests.length}`,
        `Lockfiles: ${ecosystem.lockfiles.length}`
      ],
      entityId: ecosystem.ecosystem,
      id: ecosystemNodeId,
      label: ecosystemLabels[ecosystem.ecosystem],
      summary: `${ecosystem.manifests.length} manifest(s), ${ecosystem.lockfiles.length} lockfile(s).`,
      title: ecosystemLabels[ecosystem.ecosystem],
      type: "ecosystem"
    });
    addEdge(
      edges,
      edgeKeys,
      createEdge({
        label: "detected in",
        source: repositoryNodeId,
        target: ecosystemNodeId,
        type: "detected-in"
      })
    );
  }

  const ecosystemByManifest = new Map<string, string>();
  const ecosystemByLockfile = new Map<string, string>();

  for (const ecosystem of analysis.ecosystems) {
    const ecosystemNodeId = graphNodeId("ecosystem", ecosystem.ecosystem);

    for (const path of ecosystem.manifests) {
      ecosystemByManifest.set(path, ecosystemNodeId);
    }

    for (const path of ecosystem.lockfiles) {
      ecosystemByLockfile.set(path, ecosystemNodeId);
    }
  }

  for (const manifest of analysis.detectedFiles.manifests) {
    const nodeId = graphNodeId("manifest", manifest.path);
    filePathToNodeId.set(manifest.path, nodeId);
    addNode({
      badges: [manifest.kind],
      details: [`Path: ${manifest.path}`, `Kind: ${manifest.kind}`],
      entityId: manifest.path,
      id: nodeId,
      label: manifest.path,
      path: manifest.path,
      summary: `Detected manifest: ${manifest.kind}.`,
      title: manifest.path,
      type: "manifest"
    });
    addEdge(
      edges,
      edgeKeys,
      createEdge({
        label: "detected in",
        source: ecosystemByManifest.get(manifest.path) ?? repositoryNodeId,
        target: nodeId,
        type: "detected-in"
      })
    );
  }

  for (const lockfile of analysis.detectedFiles.lockfiles) {
    const nodeId = graphNodeId("lockfile", lockfile.path);
    filePathToNodeId.set(lockfile.path, nodeId);
    addNode({
      badges: [lockfile.kind],
      details: [`Path: ${lockfile.path}`, `Kind: ${lockfile.kind}`],
      entityId: lockfile.path,
      id: nodeId,
      label: lockfile.path,
      path: lockfile.path,
      summary: `Detected lockfile: ${lockfile.kind}.`,
      title: lockfile.path,
      type: "lockfile"
    });
    addEdge(
      edges,
      edgeKeys,
      createEdge({
        label: "detected in",
        source: ecosystemByLockfile.get(lockfile.path) ?? repositoryNodeId,
        target: nodeId,
        type: "detected-in"
      })
    );
  }

  for (const signal of analysis.detectedFiles.signals) {
    const nodeId = graphNodeId("signal", signal.path);
    filePathToNodeId.set(signal.path, nodeId);
    addNode({
      badges: [signal.category, signalLabels[signal.kind]],
      details: [
        `Path: ${signal.path}`,
        `Signal: ${signalLabels[signal.kind]}`,
        `Category: ${signal.category}`
      ],
      entityId: signal.path,
      id: nodeId,
      label: signal.path,
      path: signal.path,
      summary: `Detected ${signalLabels[signal.kind]} signal.`,
      title: signal.path,
      type: "signal"
    });
    addEdge(
      edges,
      edgeKeys,
      createEdge({
        label: "detected in",
        source: repositoryNodeId,
        target: nodeId,
        type: "detected-in"
      })
    );
  }

  for (const finding of analysis.codeReviewFindings) {
    for (const path of finding.paths) {
      if (!filePathToNodeId.has(path)) {
        const nodeId = graphNodeId("signal", path);
        filePathToNodeId.set(path, nodeId);
        addNode({
          badges: [finding.sourceType],
          details: [`Path: ${path}`, `Source type: ${finding.sourceType}`],
          entityId: path,
          id: nodeId,
          label: path,
          path,
          summary: `Reviewed ${finding.sourceType} file.`,
          title: path,
          type: "signal"
        });
        addEdge(
          edges,
          edgeKeys,
          createEdge({
            label: "detected in",
            source: repositoryNodeId,
            target: nodeId,
            type: "detected-in"
          })
        );
      }
    }
  }

  for (const finding of analysis.dependencyFindings) {
    const findingNodeId = graphNodeId("dependency-finding", finding.id);
    addNode(createDependencyFindingNode(finding, analysis));

    for (const path of finding.paths) {
      const fileNodeId = findFileNodeId(path, filePathToNodeId);

      if (fileNodeId) {
        addEdge(
          edges,
          edgeKeys,
          createEdge({
            label: "caused by",
            source: fileNodeId,
            target: findingNodeId,
            type: "caused-by"
          })
        );
      }
    }
  }

  for (const finding of analysis.codeReviewFindings) {
    const findingNodeId = graphNodeId("code-finding", finding.id);
    addNode(createCodeFindingNode(finding, analysis));

    for (const path of finding.paths) {
      const fileNodeId = findFileNodeId(path, filePathToNodeId);

      if (fileNodeId) {
        addEdge(
          edges,
          edgeKeys,
          createEdge({
            label: "caused by",
            source: fileNodeId,
            target: findingNodeId,
            type: "caused-by"
          })
        );
      }
    }
  }

  for (const candidate of analysis.issueCandidates) {
    const issueNodeId = graphNodeId("issue-candidate", candidate.id);
    addNode(createIssueCandidateNode(candidate));

    for (const findingId of candidate.relatedFindingIds) {
      const dependencyFindingNodeId = graphNodeId("dependency-finding", findingId);
      const codeFindingNodeId = graphNodeId("code-finding", findingId);
      const source = nodeIds.has(dependencyFindingNodeId)
        ? dependencyFindingNodeId
        : codeFindingNodeId;

      if (nodeIds.has(source)) {
        addEdge(
          edges,
          edgeKeys,
          createEdge({
            label: "grouped into",
            source,
            target: issueNodeId,
            type: "grouped-into"
          })
        );
      }
    }
  }

  for (const candidate of analysis.prCandidates) {
    const prNodeId = graphNodeId("pr-candidate", candidate.id);
    addNode(createPRCandidateNode(candidate, analysis));

    for (const issueCandidateId of candidate.linkedIssueCandidateIds) {
      const issueNodeId = graphNodeId("issue-candidate", issueCandidateId);

      if (nodeIds.has(issueNodeId)) {
        addEdge(
          edges,
          edgeKeys,
          createEdge({
            label: "remediated by",
            source: issueNodeId,
            target: prNodeId,
            type: "remediated-by"
          })
        );
      }
    }

    for (const findingId of candidate.relatedFindingIds) {
      const dependencyFindingNodeId = graphNodeId("dependency-finding", findingId);
      const codeFindingNodeId = graphNodeId("code-finding", findingId);
      const source = nodeIds.has(dependencyFindingNodeId)
        ? dependencyFindingNodeId
        : codeFindingNodeId;

      if (nodeIds.has(source)) {
        addEdge(
          edges,
          edgeKeys,
          createEdge({
            label: "remediated by",
            source,
            target: prNodeId,
            type: "remediated-by"
          })
        );
      }
    }
  }

  for (const plan of analysis.prPatchPlans) {
    const patchPlanNodeId = graphNodeId("patch-plan", plan.id);
    const prNodeId = graphNodeId("pr-candidate", plan.prCandidateId);
    addNode(createPatchPlanNode(plan));

    if (nodeIds.has(prNodeId)) {
      addEdge(
        edges,
        edgeKeys,
        createEdge({
          label: "eligible for",
          source: prNodeId,
          target: patchPlanNodeId,
          type: "eligible-for"
        })
      );
    }
  }

  const executablePatchPlans = analysis.prPatchPlans.filter(
    (plan) => getWriteBackEligibility(plan).status === "executable"
  ).length;
  const blockedPatchPlans = analysis.prPatchPlans.length - executablePatchPlans;
  const dependencyFindingCount = analysis.dependencyFindings.length;
  const codeFindingCount = analysis.codeReviewFindings.length;
  const highSeverityFindingCount = [
    ...analysis.dependencyFindings,
    ...analysis.codeReviewFindings
  ].filter((finding) => isHighSeverity(finding.severity)).length;

  return {
    edges,
    nodes,
    summary: {
      blockedPatchPlans,
      codeFindingCount,
      dependencyFindingCount,
      edgeCount: edges.length,
      executablePatchPlans,
      highSeverityFindingCount,
      nodeCount: nodes.length
    }
  };
}

export function selectGuardianGraphNode(
  graph: GuardianGraphModel,
  nodeId: string | null
): GuardianGraphSelection | null {
  if (!nodeId) {
    return null;
  }

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return null;
  }

  const incomingEdges = graph.edges.filter((edge) => edge.target === node.id);
  const outgoingEdges = graph.edges.filter((edge) => edge.source === node.id);
  const connectedNodeIds = new Set([
    ...incomingEdges.map((edge) => edge.source),
    ...outgoingEdges.map((edge) => edge.target)
  ]);

  return {
    connectedNodes: graph.nodes.filter((candidate) =>
      connectedNodeIds.has(candidate.id)
    ),
    incomingEdges,
    node,
    outgoingEdges
  };
}
