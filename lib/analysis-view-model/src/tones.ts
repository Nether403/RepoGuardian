import type {
  PRCandidate,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";
import type { StatusTone, TraceableFinding } from "./types.js";

export function getPatchabilityTone(
  patchability: PRPatchPlan["patchability"]
): Extract<StatusTone, "active" | "muted" | "warning"> {
  if (patchability === "patch_candidate") {
    return "active";
  }

  return patchability === "patch_plan_only" ? "warning" : "muted";
}

export function getValidationTone(
  validationStatus: PRPatchPlan["validationStatus"]
): Extract<StatusTone, "active" | "muted" | "warning"> {
  if (validationStatus === "ready") {
    return "active";
  }

  return validationStatus === "ready_with_warnings" ? "warning" : "muted";
}

export function getEligibilityTone(
  status: PRWriteBackEligibility["status"]
): Extract<StatusTone, "active" | "warning"> {
  return status === "executable" ? "active" : "warning";
}

export function getCandidateReadinessTone(
  readiness: PRCandidate["readiness"]
): Extract<StatusTone, "active" | "muted" | "warning"> {
  if (readiness === "ready") {
    return "active";
  }

  return readiness === "ready_with_warnings" ? "warning" : "muted";
}

export function getRiskTone(
  riskLevel: PRCandidate["riskLevel"]
): Extract<StatusTone, "muted" | "warning"> {
  return riskLevel === "low" ? "muted" : "warning";
}

export function getSeverityTone(
  severity: TraceableFinding["severity"]
): Extract<StatusTone, "muted" | "warning"> {
  return severity === "high" || severity === "critical" ? "warning" : "muted";
}

export function getConfidenceTone(
  confidence: TraceableFinding["confidence"]
): Extract<StatusTone, "active" | "muted" | "warning"> {
  if (confidence === "high") {
    return "active";
  }

  return confidence === "medium" ? "warning" : "muted";
}

export function getReachabilityTone(
  band: "unknown" | "unlikely" | "possible" | "likely"
): Extract<StatusTone, "active" | "muted" | "warning"> {
  if (band === "likely") {
    return "warning";
  }

  if (band === "possible") {
    return "active";
  }

  return "muted";
}
