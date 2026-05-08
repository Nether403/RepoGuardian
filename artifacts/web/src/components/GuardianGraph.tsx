import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from "d3";
import { Button, EmptyState } from "./ui";
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import type {
  GuardianGraphEdge,
  GuardianGraphModel,
  GuardianGraphNode
} from "../features/graph/graph-types";

type GuardianGraphProps = {
  graph: GuardianGraphModel;
  mode?: "embedded" | "focus";
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

type Rect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type EdgeLabelPlacement = {
  x: number;
  y: number;
};

type GraphBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

type GraphViewport = {
  scale: number;
  translateX: number;
  translateY: number;
};

type PointerPanState = {
  lastX: number;
  lastY: number;
  pointerId: number;
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
const edgeLabelHeight = 16;
const edgeLabelPadding = 4;
const nodeLabelAvoidancePadding = 8;
const graphFitPadding = 54;
const graphPanPadding = 28;
const minGraphScale = 0.35;
const maxGraphScale = 3.2;
const graphZoomStep = 0.2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

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

function estimateEdgeLabelWidth(label: string): number {
  return Math.max(56, label.length * 6.4 + 16);
}

function createRect(x: number, y: number, width: number, height: number): Rect {
  return {
    bottom: y + height / 2,
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2
  };
}

function rectsOverlap(a: Rect, b: Rect, padding = 0): boolean {
  return !(
    a.right + padding < b.left ||
    a.left - padding > b.right ||
    a.bottom + padding < b.top ||
    a.top - padding > b.bottom
  );
}

function createNodeAvoidanceRect(node: LayoutNode): Rect {
  const radius = getNodeRadius(node) + nodeLabelAvoidancePadding;
  const topInset = node.writeBackHint ? radius + 18 : radius;

  return {
    bottom: node.y + radius,
    left: node.x - radius,
    right: node.x + radius,
    top: node.y - topInset
  };
}

function buildEdgeLabelCandidates(
  edge: GuardianGraphEdge,
  source: LayoutNode,
  target: LayoutNode
): EdgeLabelPlacement[] {
  const trimmedPoints = getTrimmedEdgePoints(edge, source, target);
  const dx = trimmedPoints.x2 - trimmedPoints.x1;
  const dy = trimmedPoints.y2 - trimmedPoints.y1;
  const distance = Math.hypot(dx, dy);
  const midpointX = (trimmedPoints.x1 + trimmedPoints.x2) / 2;
  const midpointY = (trimmedPoints.y1 + trimmedPoints.y2) / 2;
  const baseOffset =
    edge.type === "eligible-for" && edge.writeBackHint
      ? edgeLabelStatusOffset
      : edgeLabelOffset;

  if (distance === 0) {
    return [
      {
        x: midpointX,
        y: midpointY - baseOffset
      }
    ];
  }

  const normalX = -dy / distance;
  const normalY = dx / distance;
  const tangentX = dx / distance;
  const tangentY = dy / distance;
  const normalOffsets = [baseOffset, baseOffset + 12, baseOffset + 24];
  const tangentOffsets = [0, 16, -16];
  const candidates: EdgeLabelPlacement[] = [];

  for (const normalOffset of normalOffsets) {
    for (const direction of [1, -1] as const) {
      for (const tangentOffset of tangentOffsets) {
        candidates.push({
          x:
            midpointX +
            normalX * normalOffset * direction +
            tangentX * tangentOffset,
          y:
            midpointY +
            normalY * normalOffset * direction +
            tangentY * tangentOffset
        });
      }
    }
  }

  return candidates;
}

function buildEdgeLabelPlacements(
  edges: LayoutEdge[],
  nodes: LayoutNode[]
): Map<string, EdgeLabelPlacement> {
  const placements = new Map<string, EdgeLabelPlacement>();
  const occupiedRects: Rect[] = [];
  const nodeRects = nodes.map((node) => createNodeAvoidanceRect(node));
  const sortedEdges = [...edges].sort((left, right) => {
    const leftSource = resolveLayoutPoint(left.source);
    const leftTarget = resolveLayoutPoint(left.target);
    const rightSource = resolveLayoutPoint(right.source);
    const rightTarget = resolveLayoutPoint(right.target);
    const leftPoints = getTrimmedEdgePoints(left, leftSource, leftTarget);
    const rightPoints = getTrimmedEdgePoints(right, rightSource, rightTarget);
    const leftDistance = Math.hypot(leftPoints.x2 - leftPoints.x1, leftPoints.y2 - leftPoints.y1);
    const rightDistance = Math.hypot(
      rightPoints.x2 - rightPoints.x1,
      rightPoints.y2 - rightPoints.y1
    );

    return leftDistance - rightDistance;
  });

  for (const edge of sortedEdges) {
    if (!edge.label.trim()) {
      continue;
    }

    const source = resolveLayoutPoint(edge.source);
    const target = resolveLayoutPoint(edge.target);
    const width = estimateEdgeLabelWidth(edge.label);
    const candidates = buildEdgeLabelCandidates(edge, source, target);

    for (const candidate of candidates) {
      const rect = createRect(candidate.x, candidate.y, width, edgeLabelHeight);
      const overlapsLabel = occupiedRects.some((occupiedRect) =>
        rectsOverlap(rect, occupiedRect, edgeLabelPadding)
      );
      const overlapsNode = nodeRects.some((nodeRect) =>
        rectsOverlap(rect, nodeRect, edgeLabelPadding)
      );

      if (overlapsLabel || overlapsNode) {
        continue;
      }

      placements.set(edge.id, candidate);
      occupiedRects.push(rect);
      break;
    }
  }

  return placements;
}

function getNodeLabelWidth(node: LayoutNode): number {
  return Math.max(getNodeRadius(node) * 2, getNodeLabel(node).length * 6.6);
}

function getGraphBounds(nodes: LayoutNode[]): GraphBounds {
  if (nodes.length === 0) {
    return {
      maxX: graphWidth,
      maxY: graphHeight,
      minX: 0,
      minY: 0
    };
  }

  return nodes.reduce<GraphBounds>(
    (bounds, node) => {
      const radius = getNodeRadius(node);
      const labelHalfWidth = getNodeLabelWidth(node) / 2;
      const statusWidth = node.writeBackHint ? getStatusMarkerWidth(node.writeBackHint.status) : 0;
      const statusRightInset = node.writeBackHint ? radius + statusWidth + 4 : radius;

      return {
        maxX: Math.max(bounds.maxX, node.x + Math.max(labelHalfWidth, statusRightInset)),
        maxY: Math.max(bounds.maxY, node.y + radius + 24),
        minX: Math.min(bounds.minX, node.x - Math.max(labelHalfWidth, radius)),
        minY: Math.min(bounds.minY, node.y - (node.writeBackHint ? radius + 34 : radius))
      };
    },
    {
      maxX: -Infinity,
      maxY: -Infinity,
      minX: Infinity,
      minY: Infinity
    }
  );
}

function getFitViewport(bounds: GraphBounds): GraphViewport {
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = clamp(
    Math.min(
      (graphWidth - graphFitPadding * 2) / contentWidth,
      (graphHeight - graphFitPadding * 2) / contentHeight,
      1
    ),
    minGraphScale,
    maxGraphScale
  );

  return {
    scale,
    translateX: (graphWidth - contentWidth * scale) / 2 - bounds.minX * scale,
    translateY: (graphHeight - contentHeight * scale) / 2 - bounds.minY * scale
  };
}

function clampAxisTranslation(input: {
  boundsMaximum: number;
  boundsMinimum: number;
  scale: number;
  translate: number;
  viewportSize: number;
}): number {
  const contentMinimum = input.boundsMinimum * input.scale;
  const contentMaximum = input.boundsMaximum * input.scale;
  const contentSize = contentMaximum - contentMinimum;

  if (contentSize <= input.viewportSize - graphPanPadding * 2) {
    return (input.viewportSize - contentSize) / 2 - contentMinimum;
  }

  const minimumTranslate = input.viewportSize - graphPanPadding - contentMaximum;
  const maximumTranslate = graphPanPadding - contentMinimum;

  return clamp(input.translate, minimumTranslate, maximumTranslate);
}

function clampGraphViewport(viewport: GraphViewport, bounds: GraphBounds): GraphViewport {
  const scale = clamp(viewport.scale, minGraphScale, maxGraphScale);

  return {
    scale,
    translateX: clampAxisTranslation({
      boundsMaximum: bounds.maxX,
      boundsMinimum: bounds.minX,
      scale,
      translate: viewport.translateX,
      viewportSize: graphWidth
    }),
    translateY: clampAxisTranslation({
      boundsMaximum: bounds.maxY,
      boundsMinimum: bounds.minY,
      scale,
      translate: viewport.translateY,
      viewportSize: graphHeight
    })
  };
}

function isSameGraphViewport(left: GraphViewport, right: GraphViewport): boolean {
  return (
    Math.abs(left.scale - right.scale) < 0.001 &&
    Math.abs(left.translateX - right.translateX) < 0.001 &&
    Math.abs(left.translateY - right.translateY) < 0.001
  );
}

function getViewportTransform(viewport: GraphViewport): string {
  return `matrix(${viewport.scale} 0 0 ${viewport.scale} ${viewport.translateX} ${viewport.translateY})`;
}

function panGraphViewport(
  viewport: GraphViewport,
  bounds: GraphBounds,
  deltaX: number,
  deltaY: number
): GraphViewport {
  return clampGraphViewport(
    {
      ...viewport,
      translateX: viewport.translateX + deltaX,
      translateY: viewport.translateY + deltaY
    },
    bounds
  );
}

function zoomGraphViewport(
  viewport: GraphViewport,
  bounds: GraphBounds,
  nextScale: number,
  anchorX = graphWidth / 2,
  anchorY = graphHeight / 2
): GraphViewport {
  const scale = clamp(nextScale, minGraphScale, maxGraphScale);

  if (Math.abs(scale - viewport.scale) < 0.001) {
    return viewport;
  }

  const graphX = (anchorX - viewport.translateX) / viewport.scale;
  const graphY = (anchorY - viewport.translateY) / viewport.scale;

  return clampGraphViewport(
    {
      scale,
      translateX: anchorX - graphX * scale,
      translateY: anchorY - graphY * scale
    },
    bounds
  );
}

function getGraphPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : graphWidth;
  const height = rect.height > 0 ? rect.height : graphHeight;

  return {
    x: clamp(((clientX - rect.left) / width) * graphWidth, 0, graphWidth),
    y: clamp(((clientY - rect.top) / height) * graphHeight, 0, graphHeight)
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
  mode = "embedded",
  onSelectNode,
  selectedNodeId,
  showRelationshipLabels
}: GuardianGraphProps) {
  const layout = useMemo(() => buildLayout(graph), [graph]);
  const graphBounds = useMemo(() => getGraphBounds(layout.nodes), [layout.nodes]);
  const fitViewport = useMemo(() => getFitViewport(graphBounds), [graphBounds]);
  const [viewport, setViewport] = useState<GraphViewport>(fitViewport);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panStateRef = useRef<PointerPanState | null>(null);
  const edgeLabelPlacements = useMemo(
    () =>
      showRelationshipLabels ? buildEdgeLabelPlacements(layout.edges, layout.nodes) : null,
    [layout.edges, layout.nodes, showRelationshipLabels]
  );
  const viewportTransform = useMemo(() => getViewportTransform(viewport), [viewport]);
  const zoomPercentage = Math.round(viewport.scale * 100);
  const canResetView = !isSameGraphViewport(viewport, fitViewport);
  const canZoomIn = viewport.scale < maxGraphScale;
  const canZoomOut = viewport.scale > minGraphScale;

  useEffect(() => {
    panStateRef.current = null;
    setIsPanning(false);
    setViewport(fitViewport);
  }, [fitViewport]);

  function resetViewport() {
    panStateRef.current = null;
    setIsPanning(false);
    setViewport(fitViewport);
  }

  function zoomAtPoint(svg: SVGSVGElement, clientX: number, clientY: number, deltaY: number) {
    const anchor = getGraphPointFromClient(svg, clientX, clientY);
    const scaleDelta = deltaY < 0 ? graphZoomStep : -graphZoomStep;

    setViewport((current) =>
      zoomGraphViewport(current, graphBounds, current.scale + scaleDelta, anchor.x, anchor.y)
    );
  }

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();

      if (svg) {
        zoomAtPoint(svg, event.clientX, event.clientY, event.deltaY);
      }
    }

    svg.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      svg.removeEventListener("wheel", handleNativeWheel);
    };
  }, [graphBounds]);

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest(".guardian-graph-node")) {
      return;
    }

    event.preventDefault();

    const point = getGraphPointFromClient(
      event.currentTarget,
      event.clientX,
      event.clientY
    );

    panStateRef.current = {
      lastX: point.x,
      lastY: point.y,
      pointerId: event.pointerId
    };
    setIsPanning(true);

    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const panState = panStateRef.current;

    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const point = getGraphPointFromClient(
      event.currentTarget,
      event.clientX,
      event.clientY
    );
    const deltaX = point.x - panState.lastX;
    const deltaY = point.y - panState.lastY;

    panStateRef.current = {
      ...panState,
      lastX: point.x,
      lastY: point.y
    };

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    setViewport((current) => panGraphViewport(current, graphBounds, deltaX, deltaY));
  }

  function finishPointerPan(event: ReactPointerEvent<SVGSVGElement>) {
    const panState = panStateRef.current;

    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    panStateRef.current = null;
    setIsPanning(false);

    if (
      typeof event.currentTarget.releasePointerCapture === "function" &&
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="guardian-graph-empty">
        <EmptyState>No graph nodes match the current filters.</EmptyState>
      </div>
    );
  }

  return (
    <div
      className={`guardian-graph-stage guardian-graph-stage-${mode}${viewport.scale > minGraphScale ? " guardian-graph-stage-zoomed" : ""}${isPanning ? " guardian-graph-stage-panning" : ""}`}
    >
      <div className="guardian-graph-view-controls">
        <p className="guardian-graph-view-hint">
          Wheel to zoom and drag the canvas to pan through dense graph regions.
        </p>
        <div className="guardian-graph-view-actions">
          <span className="guardian-graph-view-status">View {zoomPercentage}%</span>
          <Button
            aria-label="Zoom out graph"
            className="guardian-graph-view-button"
            disabled={!canZoomOut}
            onClick={() =>
              setViewport((current) =>
                zoomGraphViewport(current, graphBounds, current.scale - graphZoomStep)
              )
            }
            variant="unstyled"
          >
            Zoom out
          </Button>
          <Button
            aria-label="Reset graph view"
            className="guardian-graph-view-button"
            disabled={!canResetView}
            onClick={resetViewport}
            variant="unstyled"
          >
            Reset view
          </Button>
          <Button
            aria-label="Zoom in graph"
            className="guardian-graph-view-button"
            disabled={!canZoomIn}
            onClick={() =>
              setViewport((current) =>
                zoomGraphViewport(current, graphBounds, current.scale + graphZoomStep)
              )
            }
            variant="unstyled"
          >
            Zoom in
          </Button>
        </div>
      </div>
      <svg
        aria-label="Guardian Graph visual map"
        className="guardian-graph-svg"
        data-graph-scale={viewport.scale.toFixed(2)}
        data-graph-translate-x={viewport.translateX.toFixed(1)}
        data-graph-translate-y={viewport.translateY.toFixed(1)}
        onPointerCancel={finishPointerPan}
        onPointerDown={handlePointerDown}
        onPointerLeave={finishPointerPan}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerPan}
        ref={svgRef}
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
        <g className="guardian-graph-viewport" transform={viewportTransform}>
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
                const placement = edgeLabelPlacements?.get(edge.id);

                if (!edge.label.trim() || !placement) {
                  return null;
                }

                return (
                  <text
                    className="guardian-graph-edge-label"
                    key={`${edge.id}:label`}
                    x={placement.x}
                    y={placement.y}
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
        </g>
      </svg>
    </div>
  );
}
