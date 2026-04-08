import type {
  FindingConfidence,
  FindingSeverity,
  PRWriteBackEligibilityStatus
} from "@repo-guardian/shared-types";

export type GuardianGraphNodeType =
  | "repository"
  | "ecosystem"
  | "manifest"
  | "lockfile"
  | "signal"
  | "dependency-finding"
  | "code-finding"
  | "issue-candidate"
  | "pr-candidate"
  | "patch-plan";

export type GuardianGraphEdgeType =
  | "detected-in"
  | "caused-by"
  | "grouped-into"
  | "remediated-by"
  | "eligible-for";

export type GuardianGraphNode = {
  anchorId?: string;
  badges: string[];
  confidence?: FindingConfidence;
  details: string[];
  eligibilityStatus?: PRWriteBackEligibilityStatus;
  entityId: string;
  id: string;
  label: string;
  path?: string;
  severity?: FindingSeverity;
  summary: string;
  title: string;
  type: GuardianGraphNodeType;
};

export type GuardianGraphEdge = {
  id: string;
  label: string;
  source: string;
  target: string;
  type: GuardianGraphEdgeType;
};

export type GuardianGraphModel = {
  edges: GuardianGraphEdge[];
  nodes: GuardianGraphNode[];
  summary: {
    blockedPatchPlans: number;
    codeFindingCount: number;
    dependencyFindingCount: number;
    edgeCount: number;
    executablePatchPlans: number;
    highSeverityFindingCount: number;
    nodeCount: number;
  };
};

export type GuardianGraphSelection = {
  connectedNodes: GuardianGraphNode[];
  incomingEdges: GuardianGraphEdge[];
  node: GuardianGraphNode;
  outgoingEdges: GuardianGraphEdge[];
};
