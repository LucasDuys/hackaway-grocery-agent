"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepAgentDAGProps {
  isActive: boolean;
}

const NODE_W = 180;
const NODE_H = 72;
const MARGIN_X = 40;
const COL_GAP = 100;
const ROW_GAP = 24;

const col1X = MARGIN_X;
const col2X = MARGIN_X + NODE_W + COL_GAP;
const col3X = MARGIN_X + (NODE_W + COL_GAP) * 2;

interface DemoNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  phase: number; // activation phase
  message: string;
}

const nodes: DemoNode[] = [
  { id: "prefetch", label: "Intent Parser", color: "var(--agent-prefetch)", x: col1X, y: 100, phase: 1, message: "Parse constraints" },
  { id: "order-analyst", label: "Order Analyst", color: "var(--agent-order-analyst)", x: col2X, y: 20, phase: 2, message: "10 items recommended" },
  { id: "meal-planner", label: "Meal Planner", color: "var(--agent-meal-planner)", x: col2X, y: 20 + NODE_H + ROW_GAP, phase: 2, message: "3 meals planned" },
  { id: "schedule-agent", label: "Schedule Agent", color: "var(--agent-schedule)", x: col2X, y: 20 + (NODE_H + ROW_GAP) * 2, phase: 2, message: "Wed + Sat scheduled" },
  { id: "orchestrator", label: "Orchestrator", color: "var(--agent-orchestrator)", x: col3X, y: 60, phase: 3, message: "Merging results" },
  { id: "budget-optimizer", label: "Budget Optimizer", color: "var(--agent-budget)", x: col3X, y: 60 + NODE_H + ROW_GAP, phase: 4, message: "Under EUR 80" },
];

const edges: { src: string; tgt: string; feedback?: boolean }[] = [
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
const SVG_H = 20 + (NODE_H + ROW_GAP) * 3 + 60;

function getNodeById(id: string) {
  return nodes.find((n) => n.id === id)!;
}

function edgePath(src: DemoNode, tgt: DemoNode, feedback: boolean): string {
  if (!feedback) {
    const x1 = src.x + NODE_W;
    const y1 = src.y + NODE_H / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  // Feedback loop
  const x1 = src.x + NODE_W;
  const y1 = src.y + NODE_H / 2;
  const x2 = tgt.x;
  const y2 = tgt.y + NODE_H / 2;
  const belowY = SVG_H - 10;
  return `M ${x1} ${y1} L ${x1 + 30} ${y1} Q ${x1 + 30} ${belowY}, ${(x1 + x2) / 2} ${belowY} Q ${x2 - 30} ${belowY}, ${x2 - 30} ${y2} L ${x2} ${y2}`;
}

export function StepAgentDAG({ isActive }: StepAgentDAGProps) {
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setActivePhase(0);
      return;
    }
    const timers = [
      setTimeout(() => setActivePhase(1), 600),
      setTimeout(() => setActivePhase(2), 1400),
      setTimeout(() => setActivePhase(3), 2200),
      setTimeout(() => setActivePhase(4), 3000),
      setTimeout(() => setActivePhase(5), 3800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Step 7
      </p>
      <h2 className="mb-12 text-center text-5xl font-bold text-[var(--text-primary)]">
        Agent DAG
      </h2>

      <div className="max-w-5xl w-full">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full"
          style={{ maxHeight: "400px" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker id="demo-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="#c4bdb5" />
            </marker>
            <marker id="demo-arrow-feedback" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map(({ src, tgt, feedback }) => {
            const srcNode = getNodeById(src);
            const tgtNode = getNodeById(tgt);
            const d = feedback
              ? edgePath(tgtNode, srcNode, true)
              : edgePath(srcNode, tgtNode, false);
            const srcActive = srcNode.phase <= activePhase;
            const edgeId = `demo-edge-${src}-${tgt}`;

            return (
              <g key={edgeId}>
                <motion.path
                  id={edgeId}
                  d={d}
                  fill="none"
                  strokeWidth={feedback ? 2.5 : 2}
                  strokeDasharray={feedback ? "8 5" : undefined}
                  markerEnd={feedback ? "url(#demo-arrow-feedback)" : "url(#demo-arrow)"}
                  initial={{ stroke: "#e5e0da", opacity: 0.4 }}
                  animate={
                    srcActive
                      ? { stroke: feedback ? "#f59e0b" : "#a89c90", opacity: 1 }
                      : { stroke: "#e5e0da", opacity: 0.4 }
                  }
                  transition={{ duration: 0.5 }}
                />
                {srcActive && !feedback && (
                  <circle r="4" fill="var(--agent-orchestrator)" opacity="0.7">
                    <animateMotion dur="2s" repeatCount="indefinite" rotate="auto">
                      <mpath href={`#${edgeId}`} />
                    </animateMotion>
                  </circle>
                )}
                {srcActive && feedback && activePhase >= 4 && (
                  <circle r="4" fill="#f59e0b" opacity="0.7">
                    <animateMotion dur="3s" repeatCount="indefinite" rotate="auto">
                      <mpath href={`#${edgeId}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isLit = node.phase <= activePhase;
            const bg = isLit ? node.color : "#f7f5f2";
            const textColor = isLit ? "#ffffff" : "#8a7e72";
            const borderColor = isLit ? node.color : "#ddd8d2";

            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: isLit ? 1 : 0.5 }}
                transition={{ duration: 0.5 }}
              >
                {/* Pulse ring */}
                {isLit && (
                  <rect
                    x={node.x - 4}
                    y={node.y - 4}
                    width={NODE_W + 8}
                    height={NODE_H + 8}
                    rx={16}
                    ry={16}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={2}
                    className="dag-pulse"
                  />
                )}

                <motion.rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={14}
                  ry={14}
                  initial={{ fill: "#f7f5f2", stroke: "#ddd8d2" }}
                  animate={{ fill: bg, stroke: borderColor }}
                  transition={{ duration: 0.5 }}
                  strokeWidth={1.5}
                />
                <motion.text
                  x={node.x + NODE_W / 2}
                  y={node.y + 28}
                  textAnchor="middle"
                  initial={{ fill: "#8a7e72" }}
                  animate={{ fill: textColor }}
                  transition={{ duration: 0.5 }}
                  fontSize={15}
                  fontWeight={700}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {node.label}
                </motion.text>
                {isLit && (
                  <motion.text
                    x={node.x + NODE_W / 2}
                    y={node.y + 50}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={12}
                    fontWeight={400}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    opacity={0.85}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.85 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    {node.message}
                  </motion.text>
                )}
              </motion.g>
            );
          })}

          {/* Parallel bracket */}
          <motion.text
            x={col2X - 18}
            y={20 + NODE_H + ROW_GAP + NODE_H / 2 + 2}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={50}
            fontWeight={200}
            fontFamily="system-ui"
            initial={{ opacity: 0 }}
            animate={activePhase >= 2 ? { opacity: 0.4 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {"{"}
          </motion.text>

          {/* Feedback label */}
          <motion.text
            x={(col2X + col3X + NODE_W) / 2}
            y={SVG_H - 2}
            textAnchor="middle"
            fill="#d97706"
            fontSize={13}
            fontWeight={600}
            fontStyle="italic"
            fontFamily="system-ui, -apple-system, sans-serif"
            initial={{ opacity: 0 }}
            animate={activePhase >= 4 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            feedback loop
          </motion.text>
        </svg>
      </div>

      {/* Caption */}
      <motion.div
        className="mt-8 flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={activePhase >= 5 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-lg font-medium text-[var(--text-secondary)]">
          Fat context: each agent receives ALL data, not just its slice
        </p>
        <div className="rounded-xl bg-[#1E293B] px-6 py-3">
          <code className="text-sm text-[#E2E8F0] font-mono">
            {"{ orders: [...], products: [...], budget: 8000, meals: [...] }"}
          </code>
        </div>
      </motion.div>
    </motion.div>
  );
}
