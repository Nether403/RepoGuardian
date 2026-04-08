import {
  buildGuardianGraph,
  selectGuardianGraphNode
} from "@repo-guardian/analysis-view-model";
import type {
  GuardianGraphFilterOptions,
  GuardianGraphFilters,
  GuardianGraphModel,
  GuardianGraphNode,
  GuardianGraphNodeType
} from "./graph-types";

export { buildGuardianGraph, selectGuardianGraphNode };

const graphNodeTypeOrder: GuardianGraphNodeType[] = [
  "repository",
  "ecosystem",
  "manifest",
  "lockfile",
  "signal",
  "dependency-finding",
  "code-finding",
  "issue-candidate",
  "pr-candidate",
  "patch-plan"
];

const severityOrder = ["critical", "high", "medium", "low", "info"] as const;

function nodeMatchesQuery(node: GuardianGraphNode, query: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [node.entityId, node.label, node.summary, node.title]
    .join("\n")
    .toLowerCase()
    .includes(normalized);
}

function nodeMatchesFilters(
  node: GuardianGraphNode,
  filters: GuardianGraphFilters
): boolean {
  if (!nodeMatchesQuery(node, filters.query)) {
    return false;
  }

  if (filters.entityType !== "all" && node.type !== filters.entityType) {
    return false;
  }

  if (
    filters.severity === "high-severity" &&
    node.severity !== "critical" &&
    node.severity !== "high"
  ) {
    return false;
  }

  if (
    filters.severity !== "all" &&
    filters.severity !== "high-severity" &&
    node.severity !== filters.severity
  ) {
    return false;
  }

  if (
    filters.eligibility !== "all" &&
    node.eligibilityStatus !== filters.eligibility
  ) {
    return false;
  }

  return true;
}

export function filterGuardianGraph(
  graph: GuardianGraphModel,
  filters: GuardianGraphFilters
): GuardianGraphModel {
  const nodes = graph.nodes.filter((node) => nodeMatchesFilters(node, filters));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  return {
    edges,
    nodes,
    summary: {
      ...graph.summary,
      edgeCount: edges.length,
      nodeCount: nodes.length
    }
  };
}

export function getGuardianGraphFilterOptions(
  graph: GuardianGraphModel
): GuardianGraphFilterOptions {
  const entityTypes = new Set(graph.nodes.map((node) => node.type));
  const severities = new Set(
    graph.nodes
      .map((node) => node.severity)
      .filter((severity): severity is Exclude<typeof severity, undefined> =>
        Boolean(severity)
      )
  );
  const eligibility = new Set(
    graph.nodes
      .map((node) => node.eligibilityStatus)
      .filter((status): status is Exclude<typeof status, undefined> =>
        Boolean(status)
      )
  );

  return {
    eligibility: ["all", ...(["executable", "blocked"] as const).filter((status) =>
      eligibility.has(status)
    )],
    entityTypes: [
      "all",
      ...graphNodeTypeOrder.filter((type) => entityTypes.has(type))
    ],
    severities: [
      "all",
      ...(severities.has("critical") || severities.has("high")
        ? (["high-severity"] as const)
        : []),
      ...severityOrder.filter((severity) => severities.has(severity))
    ]
  };
}
