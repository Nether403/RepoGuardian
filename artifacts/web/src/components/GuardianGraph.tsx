import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from "d3";
import { useMemo } from "react";
import type {
  GuardianGraphEdge,
  GuardianGraphModel,
  GuardianGraphNode
} from "../features/graph/graph-types";

type GuardianGraphProps = {
  graph: GuardianGraphModel;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  showRelationshipLabels: boolean;
};

type LayoutNode = GuardianGraphNode &
  SimulationNodeDatum & {
    x: number;
    y: number;
  };

type LayoutEdge = GuardianGraphEdge &
  SimulationLinkDatum<LayoutNode> & {
    source: string | LayoutNode;
    target: string | LayoutNode;
  };

const graphWidth = 920;
const graphHeight = 520;
const nodeMarkerHeight = 16;
const edgeMarkerHeight = 16;
const edgePadding = 4;
const arrowHeadInset = 12;
const arrowMarkerRefX = 7;
const arrowMarkerRefY = 4;
const edgeLabelOffset = 12;
const edgeLabelStatusOffset = 18;

function getStatusMarkerLabel(status: "blocked" | "executable"): string {
  return status === "executable" ? "exec" : "blocked";
}

function getStatusMarkerWidth(status: "blocked" | "executable"): number {
  return status === "executable" ? 34 : 50;
}

function getNodeRadius(node: GuardianGraphNode): number {
  if (node.type === "repository") {
    return 22;
  }

  if (node.type === "dependency-finding" || node.type === "code-finding") {
    return 17;
  }

  if (node.type === "patch-plan") {
    return 15;
  }

  return 13;
}

function edgeHasDirectionCue(edge: GuardianGraphEdge): boolean {
  return (
    edge.type === "detected-in" ||
    edge.type === "grouped-into" ||
    edge.type === "remediated-by" ||
    edge.type === "eligible-for"
  );
}

function getEdgeArrowMarkerId(edge: GuardianGraphEdge): string | null {
  if (!edgeHasDirectionCue(edge)) {
    return null;
  }

  return `guardian-graph-arrow-${edge.type}`;
}

function getNodePosition(index: number, total: number): { x: number; y: number } {
  if (index === 0) {
    return {
      x: graphWidth / 2,
      y: graphHeight / 2
    };
  }

  const ringIndex = index - 1;
  const angle = (ringIndex / Math.max(total - 1, 1)) * Math.PI * 2;
  const radius = 160 + (ringIndex % 3) * 34;

  return {
    x: graphWidth / 2 + Math.cos(angle) * radius,
    y: graphHeight / 2 + Math.sin(angle) * radius
  };
}

function resolveLayoutPoint(value: string | LayoutNode): LayoutNode {
  if (typeof value === "string") {
    throw new Error(`Unresolved graph edge endpoint: ${value}`);
  }

  return value;
}

function getTrimmedEdgePoints(edge: GuardianGraphEdge, source: LayoutNode, target: LayoutNode) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return {
      x1: source.x,
      x2: target.x,
      y1: source.y,
      y2: target.y
    };
  }

  const unitX = dx / distance;
  const unitY = dy / distance;
  const sourceInset = getNodeRadius(source) + edgePadding;
  const targetInset =
    getNodeRadius(target) + edgePadding + (edgeHasDirectionCue(edge) ? arrowHeadInset : 0);

  return {
    x1: source.x + unitX * sourceInset,
    x2: target.x - unitX * targetInset,
    y1: source.y + unitY * sourceInset,
    y2: target.y - unitY * targetInset
  };
}

function getEdgeLabelPosition(edge: GuardianGraphEdge, source: LayoutNode, target: LayoutNode) {
  const trimmedPoints = getTrimmedEdgePoints(edge, source, target);
  const dx = trimmedPoints.x2 - trimmedPoints.x1;
  const dy = trimmedPoints.y2 - trimmedPoints.y1;
  const distance = Math.hypot(dx, dy);
  const midpointX = (trimmedPoints.x1 + trimmedPoints.x2) / 2;
  const midpointY = (trimmedPoints.y1 + trimmedPoints.y2) / 2;

  if (distance === 0) {
    return {
      x: midpointX,
      y: midpointY
    };
  }

  const normalX = -dy / distance;
  const normalY = dx / distance;
  const offset =
    edge.type === "eligible-for" && edge.writeBackHint
      ? edgeLabelStatusOffset
      : edgeLabelOffset;

  return {
    x: midpointX + normalX * offset,
    y: midpointY + normalY * offset
  };
}

function buildLayout(graph: GuardianGraphModel): {
  edges: LayoutEdge[];
  nodes: LayoutNode[];
} {
  const nodes: LayoutNode[] = graph.nodes.map((node, index) => ({
    ...node,
    ...getNodePosition(index, graph.nodes.length)
  }));
  const edges: LayoutEdge[] = graph.edges.map((edge) => ({
    ...edge,
    source: edge.source,
    target: edge.target
  }));

  forceSimulation<LayoutNode>(nodes)
    .force(
      "link",
      forceLink<LayoutNode, LayoutEdge>(edges)
        .id((node) => node.id)
        .distance((edge) => (edge.type === "detected-in" ? 82 : 112))
        .strength(0.42)
    )
    .force("charge", forceManyBody().strength(-360))
    .force("collide", forceCollide<LayoutNode>().radius((node) => getNodeRadius(node) + 22))
    .force("center", forceCenter(graphWidth / 2, graphHeight / 2))
    .stop()
    .tick(140);

  return {
    edges,
    nodes
  };
}

function getNodeClassName(node: GuardianGraphNode, selectedNodeId: string | null) {
  const classes = [
    "guardian-graph-node",
    `guardian-graph-node-${node.type}`,
    node.severity ? `guardian-graph-node-severity-${node.severity}` : null,
    node.eligibilityStatus
      ? `guardian-graph-node-eligibility-${node.eligibilityStatus}`
      : null,
    selectedNodeId === node.id ? "guardian-graph-node-selected" : null
  ];

  return classes.filter(Boolean).join(" ");
}

function getNodeLabel(node: GuardianGraphNode): string {
  if (node.label.length <= 32) {
    return node.label;
  }

  return `${node.label.slice(0, 29)}...`;
}

function renderNodeStatusMarker(node: GuardianGraphNode) {
  if (!node.writeBackHint) {
    return null;
  }

  const label = getStatusMarkerLabel(node.writeBackHint.status);
  const width = getStatusMarkerWidth(node.writeBackHint.status);
  const radius = getNodeRadius(node);

  return (
    <g
      aria-hidden="true"
      className={`guardian-graph-node-status-marker guardian-graph-node-status-marker-${node.writeBackHint.status}`}
      transform={`translate(${radius - 2}, ${-radius - 12})`}
    >
      <rect height={nodeMarkerHeight} rx={8} ry={8} width={width} x={0} y={0} />
      <text x={width / 2} y={11}>
        {label}
      </text>
    </g>
  );
}

function renderEdgeStatusMarker(edge: GuardianGraphEdge, source: LayoutNode, target: LayoutNode) {
  if (edge.type !== "eligible-for" || !edge.writeBackHint) {
    return null;
  }

  const trimmedPoints = getTrimmedEdgePoints(edge, source, target);
  const label = getStatusMarkerLabel(edge.writeBackHint.status);
  const width = getStatusMarkerWidth(edge.writeBackHint.status);
  const midpointX = (trimmedPoints.x1 + trimmedPoints.x2) / 2;
  const midpointY = (trimmedPoints.y1 + trimmedPoints.y2) / 2;

  return (
    <g
      aria-hidden="true"
      className={`guardian-graph-edge-status-marker guardian-graph-edge-status-marker-${edge.writeBackHint.status}`}
      transform={`translate(${midpointX}, ${midpointY})`}
    >
      <rect
        height={edgeMarkerHeight}
        rx={8}
        ry={8}
        width={width}
        x={-width / 2}
        y={-edgeMarkerHeight / 2}
      />
      <text x={0} y={3}>
        {label}
      </text>
    </g>
  );
}

export function GuardianGraph({
  graph,
  onSelectNode,
  selectedNodeId,
  showRelationshipLabels
}: GuardianGraphProps) {
  const layout = useMemo(() => buildLayout(graph), [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="guardian-graph-empty">
        <p className="empty-copy">No graph nodes match the current filters.</p>
      </div>
    );
  }

  return (
    <svg
      aria-label="Guardian Graph visual map"
      className="guardian-graph-svg"
      role="img"
      viewBox={`0 0 ${graphWidth} ${graphHeight}`}
    >
      <defs>
        <marker
          id="guardian-graph-arrow-detected-in"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX={arrowMarkerRefX}
          refY={arrowMarkerRefY}
        >
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(140, 201, 255, 0.74)" />
        </marker>
        <marker
          id="guardian-graph-arrow-grouped-into"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX={arrowMarkerRefX}
          refY={arrowMarkerRefY}
        >
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(140, 201, 255, 0.74)" />
        </marker>
        <marker
          id="guardian-graph-arrow-remediated-by"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX={arrowMarkerRefX}
          refY={arrowMarkerRefY}
        >
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(155, 217, 176, 0.82)" />
        </marker>
        <marker
          id="guardian-graph-arrow-eligible-for"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          orient="auto"
          refX={arrowMarkerRefX}
          refY={arrowMarkerRefY}
        >
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(155, 217, 176, 0.82)" />
        </marker>
      </defs>
      <g className="guardian-graph-edges">
        {layout.edges.map((edge) => {
          const source = resolveLayoutPoint(edge.source);
          const target = resolveLayoutPoint(edge.target);
          const tooltip = edge.tooltip ?? null;
          const trimmedPoints = getTrimmedEdgePoints(edge, source, target);
          const markerId = getEdgeArrowMarkerId(edge);

          return (
            <line
              className={`guardian-graph-edge guardian-graph-edge-${edge.type}`}
              key={edge.id}
              markerEnd={markerId ? `url(#${markerId})` : undefined}
              x1={trimmedPoints.x1}
              x2={trimmedPoints.x2}
              y1={trimmedPoints.y1}
              y2={trimmedPoints.y2}
            >
              {tooltip ? <title>{tooltip}</title> : null}
            </line>
          );
        })}
      </g>
      {showRelationshipLabels ? (
        <g aria-hidden="true" className="guardian-graph-edge-labels">
          {layout.edges.map((edge) => {
            if (!edge.label.trim()) {
              return null;
            }

            const source = resolveLayoutPoint(edge.source);
            const target = resolveLayoutPoint(edge.target);
            const position = getEdgeLabelPosition(edge, source, target);

            return (
              <text
                className="guardian-graph-edge-label"
                key={`${edge.id}:label`}
                x={position.x}
                y={position.y}
              >
                {edge.label}
              </text>
            );
          })}
        </g>
      ) : null}
      <g className="guardian-graph-edge-markers">
        {layout.edges.map((edge) => {
          const source = resolveLayoutPoint(edge.source);
          const target = resolveLayoutPoint(edge.target);

          return (
            <g key={`${edge.id}:status-marker`}>
              {renderEdgeStatusMarker(edge, source, target)}
            </g>
          );
        })}
      </g>
      <g className="guardian-graph-nodes">
        {layout.nodes.map((node) => {
          const tooltip = node.tooltip ?? null;

          return (
            <g
              aria-label={`${node.type}: ${node.title}`}
              className={getNodeClassName(node, selectedNodeId)}
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectNode(node.id);
                }
              }}
              role="button"
              tabIndex={0}
              transform={`translate(${node.x}, ${node.y})`}
            >
              {tooltip ? <title>{tooltip}</title> : null}
              <circle r={getNodeRadius(node)} />
              {renderNodeStatusMarker(node)}
              <text dy={getNodeRadius(node) + 14}>{getNodeLabel(node)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
