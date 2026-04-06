import type {
  AnalysisWarning,
  PRPatchability,
  ValidationStatus
} from "@repo-guardian/shared-types";
import { dedupePatchPlanWarnings } from "./utils.js";

export type ValidationResult = {
  validationStatus: ValidationStatus;
  validationNotes: string[];
  patchWarnings: string[];
};

export function buildValidationResult(input: {
  patchability: PRPatchability;
  relevantWarnings: AnalysisWarning[];
  reasons: string[];
  readiness: "draft_only" | "ready_with_warnings" | "ready";
}): ValidationResult {
  const patchWarnings = dedupePatchPlanWarnings([
    ...input.relevantWarnings.map((warning) => warning.message),
    ...input.reasons
  ]);

  if (input.patchability === "not_patchable") {
    return {
      patchWarnings,
      validationNotes: [
        "Validation has not been prepared because this candidate is not patchable in the current analysis step.",
        "Human review or broader remediation planning is required before safe patch synthesis can be attempted."
      ],
      validationStatus: "blocked"
    };
  }

  if (input.patchability === "patch_plan_only") {
    return {
      patchWarnings,
      validationNotes: [
        "Validation has not been executed in this step.",
        "The candidate has a bounded patch plan, but the exact safe edit still needs human review before validation can be meaningfully run."
      ],
      validationStatus: "not_run"
    };
  }

  const validationStatus: ValidationStatus =
    input.readiness === "ready" && patchWarnings.length === 0
      ? "ready"
      : "ready_with_warnings";

  return {
    patchWarnings,
    validationNotes: [
      "Validation has not been executed in this step.",
      validationStatus === "ready"
        ? "Standard validation steps are identified and the candidate is ready for later patch synthesis."
        : "Standard validation steps are identified, but warnings reduce confidence for later patch synthesis."
    ],
    validationStatus
  };
}
