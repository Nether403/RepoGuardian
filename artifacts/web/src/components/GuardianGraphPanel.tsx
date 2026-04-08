import { useMemo, useState } from "react";
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

export function GuardianGraphPanel({ analysis }: GuardianGraphPanelProps) {
  const [filters, setFilters] = useState<GuardianGraphFilters>(
    defaultGuardianGraphFilters
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const graph = useMemo(() => buildGuardianGraph(analysis), [analysis]);
  const filteredGraph = useMemo(
    () => filterGuardianGraph(graph, filters),
    [filters, graph]
  );
  const filterOptions = useMemo(
    () => getGuardianGraphFilterOptions(graph),
    [graph]
  );
  const selection = useMemo(
    () => selectGuardianGraphNode(graph, selectedNodeId),
    [graph, selectedNodeId]
  );

  return (
    <Panel
      className="panel-wide guardian-graph-panel"
      eyebrow="Guardian Graph"
      footer={
        <div className="badge-row">
          <StatusBadge label={`${filteredGraph.summary.nodeCount} nodes`} tone="active" />
          <StatusBadge label={`${filteredGraph.summary.edgeCount} edges`} tone="muted" />
          <StatusBadge
            label={`${graph.summary.highSeverityFindingCount} high-severity findings`}
            tone={graph.summary.highSeverityFindingCount > 0 ? "warning" : "muted"}
          />
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
          <div className="guardian-graph-stats" aria-label="Guardian Graph summary">
            <span>{graph.summary.dependencyFindingCount} dependency findings</span>
            <span>{graph.summary.codeFindingCount} code findings</span>
            <span>{graph.summary.executablePatchPlans} executable patch plans</span>
            <span>{graph.summary.blockedPatchPlans} blocked patch plans</span>
          </div>
        </div>
        <div className="readiness-filter-row" aria-label="Guardian Graph filters">
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
                  {severity === "all" ? "All severities" : formatValue(severity)}
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
        </div>
        <div className="guardian-graph-workspace">
          <GuardianGraph
            graph={filteredGraph}
            onSelectNode={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
          />
          <GraphInspector selection={selection} />
        </div>
      </div>
    </Panel>
  );
}
