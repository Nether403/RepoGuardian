import type { GuardianGraphSelection } from "../features/graph/graph-types";
import { StatusBadge } from "./StatusBadge";

type GraphInspectorProps = {
  selection: GuardianGraphSelection | null;
};

function formatValue(value: string): string {
  return value.replace(/[-_]/gu, " ");
}

function getNodeTone(selection: GuardianGraphSelection): "active" | "muted" | "warning" {
  if (
    selection.node.severity === "critical" ||
    selection.node.severity === "high" ||
    selection.node.eligibilityStatus === "blocked"
  ) {
    return "warning";
  }

  if (selection.node.eligibilityStatus === "executable") {
    return "active";
  }

  return "muted";
}

export function GraphInspector({ selection }: GraphInspectorProps) {
  if (!selection) {
    return (
      <aside className="graph-inspector" aria-label="Guardian Graph inspector">
        <p className="subsection-label">Inspector</p>
        <h3>Select a graph node</h3>
        <p className="trace-copy">
          Choose a finding, candidate, file, or patch plan to see its evidence and
          remediation links without leaving the analysis view.
        </p>
      </aside>
    );
  }

  return (
    <aside className="graph-inspector" aria-label="Guardian Graph inspector">
      <div className="trace-card-header">
        <div>
          <p className="subsection-label">{formatValue(selection.node.type)}</p>
          <h3>{selection.node.title}</h3>
        </div>
        <StatusBadge label={formatValue(selection.node.type)} tone={getNodeTone(selection)} />
      </div>
      <p className="trace-copy">{selection.node.summary}</p>
      {selection.node.anchorId ? (
        <p className="resource-link">
          <a href={`#${selection.node.anchorId}`}>Jump to report detail</a>
        </p>
      ) : null}
      {selection.node.badges.length > 0 ? (
        <div className="trace-chip-row">
          {selection.node.badges.map((badge, index) => (
            <span className="trace-chip trace-chip-muted" key={`${badge}:${index}`}>
              {formatValue(badge)}
            </span>
          ))}
        </div>
      ) : null}
      {selection.node.details.length > 0 ? (
        <div>
          <p className="subsection-label">Evidence and remediation context</p>
          <ul className="simple-list">
            {selection.node.details.map((detail) => (
              <li key={`${selection.node.id}:${detail}`}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="subsection-label">Connected nodes</p>
        {selection.connectedNodes.length > 0 ? (
          <div className="trace-chip-row">
            {selection.connectedNodes.map((node) =>
              node.anchorId ? (
                <a
                  className="trace-chip trace-chip-link"
                  href={`#${node.anchorId}`}
                  key={`${selection.node.id}:${node.id}`}
                >
                  {node.title}
                </a>
              ) : (
                <span
                  className="trace-chip trace-chip-muted"
                  key={`${selection.node.id}:${node.id}`}
                >
                  {node.title}
                </span>
              )
            )}
          </div>
        ) : (
          <p className="trace-copy">No connected nodes in the current graph.</p>
        )}
      </div>
    </aside>
  );
}
