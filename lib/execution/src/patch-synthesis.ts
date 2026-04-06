import type {
  CodeReviewFinding,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";

type ExecutionReadClient = {
  fetchRepositoryFileText(request: {
    owner: string;
    path: string;
    ref: string;
    repo: string;
  }): Promise<string>;
};

export type PRExecutionSupport =
  | {
      supported: false;
      reason: string;
    }
  | {
      findingCategories: string[];
      supported: true;
    };

export type SynthesizedPRPatch = {
  branchName: string;
  commitMessage: string;
  fileChanges: Array<{
    content: string;
    path: string;
  }>;
  pullRequestBody: string;
};

const supportedWorkflowFindingCategories = new Set([
  "workflow-hardening",
  "workflow-permissions"
]);

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sanitizeBranchSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-")
    .slice(0, 48);
}

function createBranchName(candidate: PRCandidate): string {
  const candidateSegment = sanitizeBranchSegment(candidate.id) || "candidate";
  const pathSegment =
    sanitizeBranchSegment(candidate.affectedPaths[0] ?? "") || "change";

  return `repo-guardian/${candidateSegment}-${pathSegment}-${Date.now().toString(36)}`;
}

function collectLinkedWorkflowFindings(
  analysis: ExecutionPlanningContext,
  candidate: PRCandidate
): CodeReviewFinding[] {
  const candidatePath = candidate.affectedPaths[0];

  if (!candidatePath) {
    return [];
  }

  return analysis.codeReviewFindings.filter(
    (finding) =>
      candidate.relatedFindingIds.includes(finding.id) &&
      finding.paths.includes(candidatePath)
  );
}

export function evaluatePRExecutionSupport(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
}): PRExecutionSupport {
  if (input.patchPlan.patchability !== "patch_candidate") {
    return {
      reason:
        input.patchPlan.patchWarnings[0] ??
        "The linked patch plan is not patch-capable for real PR execution.",
      supported: false
    };
  }

  if (input.candidate.candidateType !== "workflow-hardening") {
    return {
      reason:
        `Automated ${input.candidate.candidateType} PR execution is not enabled in Milestone 5B.`,
      supported: false
    };
  }

  const findings = collectLinkedWorkflowFindings(input.analysis, input.candidate);

  if (findings.length === 0) {
    return {
      reason:
        "The selected workflow PR candidate does not include the linked review findings needed for safe patch synthesis.",
      supported: false
    };
  }

  const findingCategories = uniqueSorted(findings.map((finding) => finding.category));

  if (findingCategories.includes("workflow-trigger-risk")) {
    return {
      reason:
        "Workflow trigger-risk findings remain blocked for real write-back because the trigger change is not deterministic enough yet.",
      supported: false
    };
  }

  if (
    findingCategories.some(
      (category) => !supportedWorkflowFindingCategories.has(category)
    )
  ) {
    return {
      reason:
        "The selected workflow PR candidate contains unsupported workflow findings for automated patch synthesis.",
      supported: false
    };
  }

  return {
    findingCategories,
    supported: true
  };
}

function detectNewline(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function replaceWriteAllPermissions(content: string, newline: string): string {
  let replaced = false;
  const updated = content.replace(
    /^([ \t]*)permissions\s*:\s*write-all\b[^\r\n]*$/gmu,
    (_match, indentation: string) => {
      replaced = true;
      return `${indentation}permissions:${newline}${indentation}  contents: read`;
    }
  );

  if (!replaced) {
    throw new Error(
      "The workflow still needs permissions hardening, but no permissions: write-all line was found during patch synthesis."
    );
  }

  return updated;
}

function insertExplicitPermissions(content: string, newline: string): string {
  if (/^[ \t]*permissions\s*:/gmu.test(content)) {
    throw new Error(
      "The workflow hardening finding expected a missing permissions block, but the workflow already declares permissions."
    );
  }

  const permissionsBlock = `permissions:${newline}  contents: read${newline}${newline}`;
  const onMatch = /^on\s*:/mu.exec(content);

  if (onMatch?.index !== undefined) {
    return `${content.slice(0, onMatch.index)}${permissionsBlock}${content.slice(onMatch.index)}`;
  }

  return `${permissionsBlock}${content}`;
}

function buildPullRequestBody(input: {
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
}): string {
  const validationSteps =
    input.patchPlan.patchPlan?.requiredValidationSteps ?? input.candidate.testPlan;
  const linkedIssues =
    input.patchPlan.linkedIssueCandidateIds.length > 0
      ? input.patchPlan.linkedIssueCandidateIds.join(", ")
      : "none";
  const relatedFindings =
    input.patchPlan.relatedFindingIds.length > 0
      ? input.patchPlan.relatedFindingIds.join(", ")
      : "none";

  return [
    input.candidate.summary,
    "",
    "Validation follow-up:",
    ...validationSteps.map((step) => `- ${step}`),
    "",
    "Traceability:",
    `- PR candidate: ${input.candidate.id}`,
    `- Patchability: ${input.patchPlan.patchability}`,
    `- Validation status: ${input.patchPlan.validationStatus}`,
    `- Linked issue candidates: ${linkedIssues}`,
    `- Related findings: ${relatedFindings}`
  ].join("\n");
}

export async function synthesizePRCandidatePatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
}): Promise<SynthesizedPRPatch> {
  const support = evaluatePRExecutionSupport(input);

  if (!support.supported) {
    throw new Error(support.reason);
  }

  const workflowPath = input.candidate.affectedPaths[0];

  if (!workflowPath) {
    throw new Error("The selected workflow PR candidate does not identify a workflow file.");
  }

  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path: workflowPath,
    ref: repository.defaultBranch,
    repo: repository.repo
  });
  const newline = detectNewline(originalContent);

  let updatedContent = originalContent;

  if (support.findingCategories.includes("workflow-permissions")) {
    updatedContent = replaceWriteAllPermissions(updatedContent, newline);
  }

  if (support.findingCategories.includes("workflow-hardening")) {
    updatedContent = insertExplicitPermissions(updatedContent, newline);
  }

  if (updatedContent === originalContent) {
    throw new Error(
      "Repo Guardian could not synthesize a concrete workflow edit for the selected PR candidate."
    );
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(security): ${input.candidate.title}`,
    fileChanges: [
      {
        content: updatedContent,
        path: workflowPath
      }
    ],
    pullRequestBody: buildPullRequestBody(input)
  };
}
