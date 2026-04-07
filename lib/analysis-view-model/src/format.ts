import type { IssueCandidate, PRCandidate, PRPatchPlan } from "@repo-guardian/shared-types";
import type { TraceableFinding } from "./types.js";

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDisplayValue(value: string): string {
  return value.replace(/[-_]/gu, " ");
}

export function formatPatchability(value: PRPatchPlan["patchability"]): string {
  return formatDisplayValue(value);
}

export function formatValidationStatus(
  value: PRPatchPlan["validationStatus"]
): string {
  return formatDisplayValue(value);
}

export function formatReadiness(value: PRCandidate["readiness"]): string {
  return formatDisplayValue(value);
}

export function formatIssueScope(value: IssueCandidate["scope"]): string {
  return formatDisplayValue(value);
}

export function formatSourceType(value: TraceableFinding["sourceType"]): string {
  return formatDisplayValue(value);
}

export function formatSeverity(value: TraceableFinding["severity"]): string {
  return formatDisplayValue(value);
}

export function formatConfidence(value: TraceableFinding["confidence"]): string {
  return formatDisplayValue(value);
}
