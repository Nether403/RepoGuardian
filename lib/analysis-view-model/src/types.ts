import type {
  CodeReviewFinding,
  DependencyFinding,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";

export type TraceableFinding = DependencyFinding | CodeReviewFinding;

export type EligibilityFilter = "all" | PRWriteBackEligibility["status"];

export type CandidateTypeFilter = "all" | PRPatchPlan["candidateType"];

export type StatusTone = "active" | "muted" | "up-next" | "warning";

export type TraceabilityViewModel = {
  findingById: Map<string, TraceableFinding>;
  issueCandidateById: Map<string, IssueCandidate>;
  patchPlanById: Map<string, PRPatchPlan>;
  patchPlansByCandidateId: Map<string, PRPatchPlan[]>;
  patchPlansByFindingId: Map<string, PRPatchPlan[]>;
  patchPlansByIssueCandidateId: Map<string, PRPatchPlan[]>;
  prCandidateById: Map<string, PRCandidate>;
  referencedCandidates: PRCandidate[];
  referencedFindings: TraceableFinding[];
  referencedIssueCandidates: IssueCandidate[];
};

export type WriteBackReadinessSummary = {
  blocked: number;
  executable: number;
};

export type TraceabilityMapSummaryItem = {
  count: number;
  href: string;
  label: "Patch plans" | "PR candidates" | "Issue candidates" | "Findings";
};
