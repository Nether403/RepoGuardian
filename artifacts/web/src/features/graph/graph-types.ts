import type {
  FindingSeverity,
  PRWriteBackEligibilityStatus
} from "@repo-guardian/shared-types";
import type {
  GuardianGraphEdge,
  GuardianGraphModel,
  GuardianGraphNode,
  GuardianGraphNodeType,
  GuardianGraphSelection
} from "@repo-guardian/analysis-view-model";

export type {
  GuardianGraphEdge,
  GuardianGraphModel,
  GuardianGraphNode,
  GuardianGraphNodeType,
  GuardianGraphSelection
};

export type GuardianGraphEntityTypeFilter = "all" | GuardianGraphNodeType;
export type GuardianGraphSeverityFilter =
  | "all"
  | "high-severity"
  | FindingSeverity;
export type GuardianGraphEligibilityFilter =
  | "all"
  | PRWriteBackEligibilityStatus;

export type GuardianGraphFilters = {
  eligibility: GuardianGraphEligibilityFilter;
  entityType: GuardianGraphEntityTypeFilter;
  query: string;
  severity: GuardianGraphSeverityFilter;
};

export const defaultGuardianGraphFilters: GuardianGraphFilters = {
  eligibility: "all",
  entityType: "all",
  query: "",
  severity: "all"
};

export type GuardianGraphFilterOptions = {
  eligibility: GuardianGraphEligibilityFilter[];
  entityTypes: GuardianGraphEntityTypeFilter[];
  severities: GuardianGraphSeverityFilter[];
};
