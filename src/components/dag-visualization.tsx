"use client";

import type { AgentName, AgentStatus } from "@/types";

interface DAGVisualizationProps {
  agentStates: Record<AgentName, { status: AgentStatus; message: string }>;
}

const nodes: {
  id: AgentName;
  label: string;
  color: string;
  x: number;
  y: number;
}[] = [
  { id: "prefetch", label: "Intent Parser", color: "var(--agent-prefetch, #94a3b8)", x: 20, y: 50 },
  { id: "order-analyst", label: "Order Analyst", color: "var(--agent-order-analyst)", x: 160, y: 14 },
  { id: "meal-planner", label: "Meal Planner", color: "var(--agent-meal-planner)", x: 160, y: 55 },
  { id: "schedule-agent", label: "Schedule", color: "var(--agent-schedule)", x: 160, y: 96 },
  { id: "orchestrator", label: "Orchestrator", color: "var(--agent-orchestrator)", x: 320, y: 55 },
  { id: "budget-optimizer", label: "Budget Opt.", color: "var(--agent-budget)", x: 320, y: 108 },
];

const NODE_W = 104;
const NODE_H = 36;

// edges: [sourceId, targetId, dashed?]
const edges: [AgentName, AgentName, boolean][] = [
  ["prefetch", "order-analyst", false],
  ["prefetch", "meal-planner", false],
  ["prefetch", "schedule-agent", false],
  ["order-analyst", "orchestrator", false],
  ["meal-planner", "orchestrator", false],
  ["schedule-agent", "orchestrator", false],
  ["orchestrator", "budget-optimizer", false],
  ["budget-optimizer", "meal-planner", true], // feedback loop
];

function getStatusStyle(status: AgentStatus, color: string) {
  switch (status) {
    case "pending":
      return {
        bg: "#e5e7eb",
        textColor: "#9ca3af",
        border: "#d1d5db",
      };
    case "running":
      return {
        bg: color,
        textColor: "#ffffff",
        border: color,
      };
    case "complete":
      return {
        bg: color,
        textColor: "#ffffff",
        border: color,
      };
    case "error":
      return {
        bg: "#ef4444",
        textColor: "#ffffff",
        border: "#dc2626",
      };
  }
}

function edgePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  isFeedback: boolean
): string {
  // Source point: right edge center of source node
  const x1 = sx + NODE_W;
  const y1 = sy + NODE_H / 2;

  if (!isFeedback) {
    // Target point: left edge center of target node
    const x2 = tx;
    const y2 = ty + NODE_H / 2;
    // Simple horizontal-then-vertical path
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  // Feedback loop: goes down from orchestrator, curves under, comes back to meal-planner left
  const x2 = tx;
  const y2 = ty + NODE_H / 2;
  // Go down from source bottom, curve under the graph, back up to target left
  const belowY = 145;
  return `M ${x1} ${y1} L ${x1 + 16} ${y1} Q ${x1 + 16} ${belowY}, ${(x1 + x2) / 2} ${belowY} Q ${x2 - 16} ${belowY}, ${x2 - 16} ${y2} L ${x2} ${y2}`;
}

export function DAGVisualization({ agentStates }: DAGVisualizationProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Agent Pipeline
      </p>
      <svg
        viewBox="0 0 450 155"
        className="w-full"
        style={{ maxHeight: "140px" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Edges */}
        {edges.map(([srcId, tgtId, dashed]) => {
          const src = nodeMap.get(srcId)!;
          const tgt = nodeMap.get(tgtId)!;
          const d = edgePath(src.x, src.y, tgt.x, tgt.y, dashed);
          return (
            <path
              key={`${srcId}-${tgtId}`}
              d={d}
              fill="none"
              stroke={dashed ? "#f59e0b" : "#d1d5db"}
              strokeWidth={dashed ? 1.5 : 1.5}
              strokeDasharray={dashed ? "4 3" : undefined}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Arrowhead marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 6 3, 0 6" fill="#d1d5db" />
          </marker>
        </defs>

        {/* Nodes */}
        {nodes.map((node) => {
          const state = agentStates[node.id] ?? {
            status: "pending" as AgentStatus,
            message: "",
          };
          const style = getStatusStyle(state.status, node.color);

          return (
            <g key={node.id}>
              {/* Pulse ring for running state */}
              {state.status === "running" && (
                <rect
                  x={node.x - 3}
                  y={node.y - 3}
                  width={NODE_W + 6}
                  height={NODE_H + 6}
                  rx={10}
                  ry={10}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={2}
                  className="dag-pulse"
                />
              )}

              {/* Node background */}
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                ry={8}
                fill={style.bg}
                stroke={style.border}
                strokeWidth={1.5}
              />

              {/* Label */}
              <text
                x={node.x + NODE_W / 2}
                y={node.y + (state.status === "complete" ? 15 : NODE_H / 2 + 1)}
                textAnchor="middle"
                dominantBaseline={state.status === "complete" ? "auto" : "central"}
                fill={style.textColor}
                fontSize={10}
                fontWeight={600}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {node.label}
              </text>

              {/* Complete indicator */}
              {state.status === "complete" && (
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + NODE_H - 7}
                  textAnchor="middle"
                  fill={style.textColor}
                  fontSize={8}
                  fontWeight={500}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  opacity={0.85}
                >
                  Done
                </text>
              )}

              {/* Error indicator */}
              {state.status === "error" && (
                <text
                  x={node.x + NODE_W - 10}
                  y={node.y + 12}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={700}
                >
                  !
                </text>
              )}
            </g>
          );
        })}

        {/* Feedback label */}
        <text
          x={240}
          y={152}
          textAnchor="middle"
          fill="#f59e0b"
          fontSize={8}
          fontStyle="italic"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          feedback loop
        </text>
      </svg>
    </div>
  );
}
