import type {
  AnalysisWarning,
  PRCandidate,
  PRPatchability
} from "@repo-guardian/shared-types";
import { selectPatchWarnings } from "./utils.js";

export type PatchabilityAssessment = {
  patchability: PRPatchability;
  relevantWarnings: AnalysisWarning[];
  reasons: string[];
};

function assessDependencyCandidate(candidate: PRCandidate): PRPatchability {
  const isBounded =
    candidate.affectedPackages.length === 1 &&
    candidate.affectedPaths.length >= 1 &&
    candidate.affectedPaths.length <= 3;

  if (!isBounded) {
    return "not_patchable";
  }

  if (
    candidate.confidence === "high" &&
    candidate.readiness !== "draft_only" &&
    candidate.riskLevel === "low"
  ) {
    return "patch_candidate";
  }

  return "patch_plan_only";
}

function assessWorkflowCandidate(candidate: PRCandidate): PRPatchability {
  if (candidate.affectedPaths.length !== 1) {
    return "not_patchable";
  }

  if (
    candidate.confidence === "high" &&
    candidate.readiness !== "draft_only" &&
    candidate.riskLevel === "low"
  ) {
    return "patch_candidate";
  }

  return "patch_plan_only";
}

function assessExecutionCandidate(candidate: PRCandidate): PRPatchability {
  if (candidate.affectedPaths.length !== 1 || candidate.confidence === "low") {
    return "not_patchable";
  }

  return "patch_plan_only";
}

function buildAssessmentReasons(
  candidate: PRCandidate,
  patchability: PRPatchability
): string[] {
  switch (candidate.candidateType) {
    case "dependency-upgrade":
      if (patchability === "patch_candidate") {
        return [];
      }

      if (patchability === "patch_plan_only") {
        return [
          "Dependency remediation is bounded, but the final patch should be reviewed before file edits are synthesized."
        ];
      }

      return ["Dependency upgrade scope is not bounded tightly enough for safe patch planning."];
    case "workflow-hardening":
      if (patchability === "patch_candidate") {
        return [];
      }

      if (patchability === "patch_plan_only") {
        return [
          "Workflow hardening is localized, but the permission and trigger intent should be confirmed before generating edits."
        ];
      }

      return ["Workflow remediation affects more than one bounded file path."];
    case "dangerous-execution":
    case "shell-execution":
      if (patchability === "patch_plan_only") {
        return [
          "Execution hardening remains planning-only because the safe replacement pattern still needs human confirmation."
        ];
      }

      return ["Execution remediation is not bounded enough for safe patch planning."];
    case "secret-remediation":
      return [
        "Secret remediation requires runtime configuration review or credential rotation and is not safe for automated patch planning."
      ];
    case "dependency-review":
      return [
        "Dependency review candidates do not yet have a concrete version change that can be turned into a safe patch."
      ];
    case "general-hardening":
      return [
        "General hardening candidates are too broad for deterministic patch planning in this step."
      ];
  }
}

export function assessPatchability(input: {
  candidate: PRCandidate;
  warningDetails: AnalysisWarning[];
}): PatchabilityAssessment {
  const relevantWarnings = selectPatchWarnings(input.warningDetails, input.candidate);

  let patchability: PRPatchability;

  switch (input.candidate.candidateType) {
    case "dependency-upgrade":
      patchability = assessDependencyCandidate(input.candidate);
      break;
    case "workflow-hardening":
      patchability = assessWorkflowCandidate(input.candidate);
      break;
    case "dangerous-execution":
    case "shell-execution":
      patchability = assessExecutionCandidate(input.candidate);
      break;
    case "secret-remediation":
    case "dependency-review":
    case "general-hardening":
      patchability = "not_patchable";
      break;
  }

  return {
    patchability,
    reasons: buildAssessmentReasons(input.candidate, patchability),
    relevantWarnings
  };
}
