import type {
  PatchPlan,
  PRCandidate,
  PRPatchability
} from "@repo-guardian/shared-types";

function buildDependencyPlan(candidate: PRCandidate): PatchPlan {
  return {
    filesPlanned: candidate.expectedFileChanges,
    patchStrategy:
      "Update the identified dependency declaration and refresh the matching lockfile entries only.",
    constraints: [
      "Keep the change scoped to the identified package and files.",
      "Avoid unrelated dependency churn while refreshing the lockfile."
    ],
    requiredHumanReview: [
      "Confirm the chosen upgrade path is compatible with the affected workspace.",
      "Review the lockfile diff for unintended package changes."
    ],
    requiredValidationSteps: candidate.testPlan
  };
}

function buildWorkflowPlan(candidate: PRCandidate): PatchPlan {
  return {
    filesPlanned: candidate.expectedFileChanges,
    patchStrategy:
      "Edit the single workflow file to reduce permissions and narrow risky trigger behavior.",
    constraints: [
      "Keep edits inside the identified workflow file.",
      "Do not change unrelated jobs, steps, or release automation behavior."
    ],
    requiredHumanReview: [
      "Verify the workflow still has the minimum permissions needed for legitimate jobs.",
      "Confirm the trigger hardening still matches the repository's contribution model."
    ],
    requiredValidationSteps: candidate.testPlan
  };
}

function buildExecutionPlan(candidate: PRCandidate): PatchPlan {
  return {
    filesPlanned: candidate.expectedFileChanges,
    patchStrategy:
      candidate.candidateType === "dangerous-execution"
        ? "Replace the risky dynamic execution site with a safer explicit control path."
        : "Replace shell-backed execution with an explicit invocation path and validated arguments.",
    constraints: [
      "Keep the code change localized to the identified file.",
      "Avoid broad refactors while removing the risky execution construct."
    ],
    requiredHumanReview: [
      "Verify the safer execution path preserves intended behavior for the current call site.",
      "Confirm the refactor does not widen the input surface or break supported inputs."
    ],
    requiredValidationSteps: candidate.testPlan
  };
}

export function buildPatchPlan(input: {
  candidate: PRCandidate;
  patchability: PRPatchability;
}): PatchPlan | null {
  if (input.patchability === "not_patchable") {
    return null;
  }

  switch (input.candidate.candidateType) {
    case "dependency-upgrade":
      return buildDependencyPlan(input.candidate);
    case "workflow-hardening":
      return buildWorkflowPlan(input.candidate);
    case "dangerous-execution":
    case "shell-execution":
      return buildExecutionPlan(input.candidate);
    case "dependency-review":
    case "general-hardening":
    case "secret-remediation":
      return null;
  }
}
