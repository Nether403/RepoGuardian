import type { IconName } from "./Icon";

export const EYEBROW_ICONS: Record<string, IconName> = {
  "Approval-Gated Analysis": "shield",
  "Fleet Admin": "fleet",
  "Repository Intake": "shield",
  "Empty State": "compass",
  "Saved Runs": "refresh",
  Compare: "arrow-right",
  Queue: "activity",
  "Fleet Overview": "fleet",
  "Workspace Access": "github",
  "Policy History": "alert",
  "Tracked Repositories": "github",
  Scheduling: "refresh",
  "PR Lifecycle": "github",
  Inspector: "search",
  Findings: "warning",
  Warnings: "warning",
  "Snapshot Coverage": "warning",
  Ecosystems: "spark",
  Manifests: "spark",
  Lockfiles: "spark",
  Signals: "spark",
  "Guardian Graph": "compass",
  Execution: "play",
  "Execution Result": "check",
  "Action Selection": "check",
  "PR Readiness": "shield",
  "PR Candidates": "github",
  "Issue Candidates": "alert",
  Repository: "shield",
  Tree: "spark"
};

export function resolveEyebrowIcon(eyebrow: string | undefined): IconName | undefined {
  if (!eyebrow) return undefined;
  return EYEBROW_ICONS[eyebrow];
}
