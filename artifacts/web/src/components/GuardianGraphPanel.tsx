import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { AnalyzeRepoResponse } from "@repo-guardian/shared-types";
import { buildGuardianGraph, selectGuardianGraphNode } from "../features/graph/build-guardian-graph";
import {
  defaultGuardianGraphFilters,
  type GuardianGraphEligibilityFilter,
  type GuardianGraphEntityTypeFilter,
  type GuardianGraphFilters,
  type GuardianGraphSeverityFilter
} from "../features/graph/graph-types";
import {
  filterGuardianGraph,
  getGuardianGraphFilterOptions
} from "../features/graph/build-guardian-graph";
import { GuardianGraph } from "./GuardianGraph";
import { GraphInspector } from "./GraphInspector";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type GuardianGraphPanelProps = {
  analysis: AnalyzeRepoResponse;
};

function formatValue(value: string): string {
  return value.replace(/[-_]/gu, " ");
}

function formatSeverityFilterLabel(value: GuardianGraphSeverityFilter): string {
  if (value === "all") {
    return "All severities";
  }

  if (value === "high-severity") {
    return "High + critical";
  }

  return formatValue(value);
}

export function GuardianGraphPanel({ analysis }: GuardianGraphPanelProps) {
  const [filters, setFilters] = useState<GuardianGraphFilters>(
    defaultGuardianGraphFilters
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(false);
  const graph = useMemo(() => buildGuardianGraph(analysis), [analysis]);
  const deferredQuery = useDeferredValue(filters.query);
  const appliedFilters = useMemo(
    () => ({
      ...filters,
      query: deferredQuery
    }),
    [deferredQuery, filters]
  );
  const filteredGraph = useMemo(
    () => filterGuardianGraph(graph, appliedFilters),
    [appliedFilters, graph]
  );
  const filterOptions = useMemo(
    () => getGuardianGraphFilterOptions(graph),
    [graph]
  );
  const selection = useMemo(
    () => selectGuardianGraphNode(filteredGraph, selectedNodeId),
    [filteredGraph, selectedNodeId]
  );
  const hasWorkflowHoverHints = useMemo(
    () => graph.nodes.some((node) => Boolean(node.writeBackHint)),
    [graph]
  );

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const isSelectedNodeVisible = filteredGraph.nodes.some(
      (node) => node.id === selectedNodeId
    );

    if (!isSelectedNodeVisible) {
      setSelectedNodeId(null);
    }
  }, [filteredGraph.nodes, selectedNodeId]);

  return (
    <Panel
      className="panel-wide guardian-graph-panel"
      eyebrow="Guardian Graph"
      footer={
        <div className="badge-row">
          <StatusBadge label={`${filteredGraph.summary.nodeCount} nodes`} tone="active" />
          <StatusBadge label={`${filteredGraph.summary.edgeCount} edges`} tone="muted" />
        </div>
      }
      title="Visual traceability map"
    >
      <div className="guardian-graph-shell">
        <div className="guardian-graph-copy">
          <p className="trace-copy">
            A deterministic graph built from the current analysis. Use it to jump
            from a high-risk finding to the issue, PR, patch plan, and write-back
            eligibility that cover it.
          </p>
          {hasWorkflowHoverHints ? (
            <p className="guardian-graph-hint">
              Hover workflow nodes and eligible-for edges to preview write-back
              status.
            </p>
          ) : null}
          <div className="guardian-graph-stats" aria-label="Guardian Graph summary">
            <span>{graph.summary.dependencyFindingCount} dependency findings</span>
            <span>{graph.summary.codeFindingCount} code findings</span>
            <button
              aria-pressed={filters.eligibility === "executable"}
              className="guardian-graph-stat-button"
              disabled={graph.summary.executablePatchPlans === 0}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  eligibility:
                    current.eligibility === "executable" ? "all" : "executable"
                }))
              }
              type="button"
            >
              {graph.summary.executablePatchPlans} executable patch plans
            </button>
            <button
              aria-pressed={filters.eligibility === "blocked"}
              className="guardian-graph-stat-button"
              disabled={graph.summary.blockedPatchPlans === 0}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  eligibility:
                    current.eligibility === "blocked" ? "all" : "blocked"
                }))
              }
              type="button"
            >
              {graph.summary.blockedPatchPlans} blocked patch plans
            </button>
            <button
              aria-pressed={filters.severity === "high-severity"}
              className="guardian-graph-stat-button"
              disabled={graph.summary.highSeverityFindingCount === 0}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  severity:
                    current.severity === "high-severity" ? "all" : "high-severity"
                }))
              }
              type="button"
            >
              {graph.summary.highSeverityFindingCount} high-severity findings
            </button>
          </div>
          <div className="guardian-graph-legend" aria-label="Guardian Graph legend">
            <span className="guardian-graph-legend-item">
              <span className="guardian-graph-legend-node guardian-graph-legend-node-finding" />
              Findings
            </span>
            <span className="guardian-graph-legend-item">
              <span className="guardian-graph-legend-node guardian-graph-legend-node-issue" />
              Issue candidates
            </span>
            <span className="guardian-graph-legend-item">
              <span className="guardian-graph-legend-node guardian-graph-legend-node-pr" />
              PR candidates
            </span>
            <span className="guardian-graph-legend-item">
              <span className="guardian-graph-legend-node guardian-graph-legend-node-patch" />
              Patch plans
            </span>
            <span className="guardian-graph-legend-item">
              <span className="guardian-graph-legend-edge" />
              eligible-for edge
            </span>
            {hasWorkflowHoverHints ? (
              <span className="guardian-graph-legend-note">
                Hover reveals workflow write-back status when available.
              </span>
            ) : null}
          </div>
        </div>
        <div className="readiness-filter-row" aria-label="Guardian Graph filters">
          <label>
            <span>Search</span>
            <input
              aria-label="Search graph"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  query: event.target.value
                }))
              }
              placeholder="Search titles, summaries, or IDs"
              type="search"
              value={filters.query}
            />
          </label>
          <label>
            <span>Entity type</span>
            <select
              aria-label="Graph entity type"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  entityType: event.target.value as GuardianGraphEntityTypeFilter
                }))
              }
              value={filters.entityType}
            >
              {filterOptions.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType === "all" ? "All entity types" : formatValue(entityType)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Severity</span>
            <select
              aria-label="Graph severity"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  severity: event.target.value as GuardianGraphSeverityFilter
                }))
              }
              value={filters.severity}
            >
              {filterOptions.severities.map((severity) => (
                <option key={severity} value={severity}>
                  {formatSeverityFilterLabel(severity)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Write-back</span>
            <select
              aria-label="Graph write-back eligibility"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  eligibility: event.target.value as GuardianGraphEligibilityFilter
                }))
              }
              value={filters.eligibility}
            >
              {filterOptions.eligibility.map((eligibility) => (
                <option key={eligibility} value={eligibility}>
                  {eligibility === "all"
                    ? "All write-back states"
                    : formatValue(eligibility)}
                </option>
              ))}
            </select>
          </label>
          <label className="guardian-graph-toggle-control">
            <span>Display</span>
            <span className="guardian-graph-toggle-input">
              <input
                aria-label="Show relationship labels"
                checked={showRelationshipLabels}
                onChange={(event) => setShowRelationshipLabels(event.target.checked)}
                type="checkbox"
              />
              Show relationship labels
            </span>
          </label>
        </div>
        <div className="guardian-graph-workspace">
          <GuardianGraph
            graph={filteredGraph}
            onSelectNode={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
            showRelationshipLabels={showRelationshipLabels}
          />
          <GraphInspector selection={selection} />
        </div>
      </div>
    </Panel>
  );
}
