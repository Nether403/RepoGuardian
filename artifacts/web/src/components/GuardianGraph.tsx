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

export function GuardianGraph({
  graph,
  onSelectNode,
  selectedNodeId
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
      <g className="guardian-graph-edges">
        {layout.edges.map((edge) => {
          const source = resolveLayoutPoint(edge.source);
          const target = resolveLayoutPoint(edge.target);
          const tooltip = edge.tooltip ?? null;

          return (
            <line
              className={`guardian-graph-edge guardian-graph-edge-${edge.type}`}
              key={edge.id}
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
            >
              {tooltip ? <title>{tooltip}</title> : null}
            </line>
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
              <text dy={getNodeRadius(node) + 14}>{getNodeLabel(node)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
