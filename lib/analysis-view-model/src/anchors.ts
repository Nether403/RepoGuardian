export const TRACEABILITY_PATCH_PLANS_SECTION_ID = "traceability-patch-plans";
export const TRACEABILITY_PR_CANDIDATES_SECTION_ID =
  "traceability-pr-candidates";
export const TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID =
  "traceability-issue-candidates";
export const TRACEABILITY_FINDINGS_SECTION_ID = "traceability-findings";

export function buildAnchorId(prefix: string, rawId: string): string {
  const normalized = rawId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return `${prefix}-${normalized || "item"}`;
}

export function getPatchPlanAnchorId(patchPlanId: string): string {
  return buildAnchorId("patch-plan", patchPlanId);
}

export function getPRCandidateAnchorId(candidateId: string): string {
  return buildAnchorId("pr-candidate", candidateId);
}

export function getIssueCandidateAnchorId(issueCandidateId: string): string {
  return buildAnchorId("issue-candidate", issueCandidateId);
}

export function getFindingAnchorId(findingId: string): string {
  return buildAnchorId("finding", findingId);
}
