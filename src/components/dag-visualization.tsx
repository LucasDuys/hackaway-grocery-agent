"use client";

import type { AgentName, AgentStatus } from "@/types";

interface DAGVisualizationProps {
  agentStates: Record<AgentName, { status: AgentStatus; message: string }>;
}

const NODE_W = 130;
const NODE_H = 54;

interface DAGNode {
  id: AgentName;
  label: string;
  color: string;
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/*  Layout: horizontal flow, 3 columns                                 */
/*  Col 1: prefetch                                                    */
/*  Col 2: order-analyst, meal-planner, schedule-agent (parallel)      */
/*  Col 3: orchestrator, budget-optimizer                              */
/* ------------------------------------------------------------------ */

const MARGIN_X = 30;
const COL_GAP = 60;
const ROW_GAP = 16;

const col1X = MARGIN_X;
const col2X = MARGIN_X + NODE_W + COL_GAP;
const col3X = MARGIN_X + (NODE_W + COL_GAP) * 2;

const nodes: DAGNode[] = [
  { id: "prefetch", label: "Intent Parser", color: "var(--agent-prefetch)", x: col1X, y: 72 },
  { id: "order-analyst", label: "Order Analyst", color: "var(--agent-order-analyst)", x: col2X, y: 10 },
  { id: "meal-planner", label: "Meal Planner", color: "var(--agent-meal-planner)", x: col2X, y: 10 + NODE_H + ROW_GAP },
  { id: "schedule-agent", label: "Schedule Agent", color: "var(--agent-schedule)", x: col2X, y: 10 + (NODE_H + ROW_GAP) * 2 },
  { id: "orchestrator", label: "Orchestrator", color: "var(--agent-orchestrator)", x: col3X, y: 44 },
  { id: "budget-optimizer", label: "Budget Optimizer", color: "var(--agent-budget)", x: col3X, y: 44 + NODE_H + ROW_GAP },
];

const edges: { src: AgentName; tgt: AgentName; feedback?: boolean }[] = [
  { src: "prefetch", tgt: "order-analyst" },
  { src: "prefetch", tgt: "meal-planner" },
  { src: "prefetch", tgt: "schedule-agent" },
  { src: "order-analyst", tgt: "orchestrator" },
  { src: "meal-planner", tgt: "orchestrator" },
  { src: "schedule-agent", tgt: "orchestrator" },
  { src: "orchestrator", tgt: "budget-optimizer" },
  { src: "budget-optimizer", tgt: "meal-planner", feedback: true },
];

const SVG_W = col3X + NODE_W + MARGIN_X;
const SVG_H = 10 + (NODE_H + ROW_GAP) * 3 + 30;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusStyle(status: AgentStatus, color: string) {
  switch (status) {
    case "pending":
      return { bg: "#f3f0ed", text: "#a89c90", border: "#e5e0da", opacity: 0.7 };
    case "running":
      return { bg: color, text: "#ffffff", border: color, opacity: 1 };
    case "complete":
      return { bg: color, text: "#ffffff", border: color, opacity: 1 };
    case "error":
      return { bg: "#ef4444", text: "#ffffff", border: "#dc2626", opacity: 1 };
  }
}

function edgePath(src: DAGNode, tgt: DAGNode, feedback: boolean): string {
  if (!feedback) {
    const x1 = src.x + NODE_W;
    const y1 = src.y + NODE_H / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  // Feedback loop: goes below everything and curves back
  const x1 = tgt.x + NODE_W; // budget-optimizer right edge
  const y1 = tgt.y + NODE_H / 2;
  const x2 = src.x; // meal-planner left edge
  const y2 = src.y + NODE_H / 2;
  // Note: for the feedback edge, src=budget-optimizer, tgt=meal-planner
  // so we draw from budget-optimizer bottom to below, then curve back left to meal-planner
  const belowY = SVG_H - 10;
  return `M ${x1} ${y1} L ${x1 + 20} ${y1} Q ${x1 + 20} ${belowY}, ${(x1 + x2) / 2} ${belowY} Q ${x2 - 20} ${belowY}, ${x2 - 20} ${y2} L ${x2} ${y2}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DAGVisualization({ agentStates }: DAGVisualizationProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="shrink-0 border-b border-[var(--border-light)] px-4 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Agent Pipeline
      </p>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ maxHeight: "220px" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Arrowhead */}
          <marker
            id="dag-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#c4bdb5" />
          </marker>
          <marker
            id="dag-arrow-feedback"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#f59e0b" />
          </marker>

          {/* Animated dot for active edges */}
          <circle id="flow-dot" r="3" fill="var(--agent-orchestrator)" />
        </defs>

        {/* Edges */}
        {edges.map(({ src, tgt, feedback }) => {
          const srcNode = nodeMap.get(src)!;
          const tgtNode = nodeMap.get(tgt)!;
          // For feedback edge, swap since we go from budget-optimizer back to meal-planner
          const d = feedback
            ? edgePath(tgtNode, srcNode, true)
            : edgePath(srcNode, tgtNode, false);

          const srcStatus = agentStates[src]?.status ?? "pending";
          const tgtStatus = agentStates[tgt]?.status ?? "pending";
          const isActive =
            srcStatus === "running" ||
            srcStatus === "complete" ||
            tgtStatus === "running";
          const edgeId = `edge-${src}-${tgt}`;

          return (
            <g key={edgeId}>
              <path
                id={edgeId}
                d={d}
                fill="none"
                stroke={feedback ? "#f59e0b" : isActive ? "#a89c90" : "#e5e0da"}
                strokeWidth={feedback ? 2 : 2}
                strokeDasharray={feedback ? "6 4" : undefined}
                markerEnd={feedback ? "url(#dag-arrow-feedback)" : "url(#dag-arrow)"}
                className="transition-[stroke] duration-300"
              />
              {/* Animated flow dot */}
              {isActive && !feedback && (
                <circle r="3" fill="var(--agent-orchestrator)" opacity="0.7">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href={`#${edgeId}`} />
                  </animateMotion>
                </circle>
              )}
              {isActive && feedback && (
                <circle r="3" fill="#f59e0b" opacity="0.7">
                  <animateMotion
                    dur="3s"
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href={`#${edgeId}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const state = agentStates[node.id] ?? {
            status: "pending" as AgentStatus,
            message: "",
          };
          const style = getStatusStyle(state.status, node.color);

          return (
            <g key={node.id} style={{ opacity: style.opacity }}>
              {/* Pulse ring for running */}
              {state.status === "running" && (
                <rect
                  x={node.x - 4}
                  y={node.y - 4}
                  width={NODE_W + 8}
                  height={NODE_H + 8}
                  rx={14}
                  ry={14}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={2}
                  className="dag-pulse"
                />
              )}

              {/* Node body */}
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={12}
                ry={12}
                fill={style.bg}
                stroke={style.border}
                strokeWidth={1.5}
                className="transition-all duration-300"
              />

              {/* Agent label */}
              <text
                x={node.x + NODE_W / 2}
                y={node.y + (state.message ? 20 : NODE_H / 2 + 1)}
                textAnchor="middle"
                dominantBaseline={state.message ? "auto" : "central"}
                fill={style.text}
                fontSize={12}
                fontWeight={600}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {node.label}
              </text>

              {/* One-line summary */}
              {state.message && (
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 36}
                  textAnchor="middle"
                  fill={style.text}
                  fontSize={9}
                  fontWeight={400}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  opacity={0.85}
                >
                  {state.message.length > 22
                    ? state.message.slice(0, 20) + "..."
                    : state.message}
                </text>
              )}

              {/* Complete check */}
              {state.status === "complete" && (
                <g transform={`translate(${node.x + NODE_W - 16}, ${node.y + 6})`}>
                  <circle cx="5" cy="5" r="5" fill="rgba(255,255,255,0.3)" />
                  <polyline
                    points="2 5, 5 8, 9 2"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Error indicator */}
              {state.status === "error" && (
                <text
                  x={node.x + NODE_W - 12}
                  y={node.y + 14}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight={700}
                >
                  !
                </text>
              )}
            </g>
          );
        })}

        {/* Parallel indicator bracket */}
        <text
          x={col2X - 14}
          y={10 + NODE_H + ROW_GAP + NODE_H / 2 + 1}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={36}
          fontWeight={200}
          fontFamily="system-ui"
          opacity={0.4}
        >
          {"{"}
        </text>

        {/* Feedback label */}
        <text
          x={(col2X + col3X + NODE_W) / 2}
          y={SVG_H - 2}
          textAnchor="middle"
          fill="#f59e0b"
          fontSize={10}
          fontStyle="italic"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          feedback loop
        </text>
      </svg>
    </div>
  );
}
