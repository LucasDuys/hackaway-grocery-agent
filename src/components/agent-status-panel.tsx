"use client";

import type { AgentName, AgentStatus } from "@/types";

const agents: { name: AgentName; label: string; color: string }[] = [
  { name: "order-analyst", label: "Order Analyst", color: "var(--agent-order-analyst)" },
  { name: "meal-planner", label: "Meal Planner", color: "var(--agent-meal-planner)" },
  { name: "schedule-agent", label: "Schedule", color: "var(--agent-schedule)" },
  { name: "budget-optimizer", label: "Budget", color: "var(--agent-budget)" },
  { name: "orchestrator", label: "Orchestrator", color: "var(--agent-orchestrator)" },
];

const statusIndicators: Record<AgentStatus, { className: string; symbol: string }> = {
  pending: { className: "bg-gray-300", symbol: "" },
  running: { className: "bg-blue-500 animate-pulse", symbol: "" },
  complete: { className: "bg-green-500", symbol: "" },
  error: { className: "bg-red-500", symbol: "" },
};

interface AgentStatusPanelProps {
  agentStates: Record<AgentName, { status: AgentStatus; message: string }>;
}

export function AgentStatusPanel({ agentStates }: AgentStatusPanelProps) {
  return (
    <div className="agent-status-row flex shrink-0 items-center gap-3 border-b border-[var(--border-light)] px-3 sm:px-4 py-3">
      {agents.map(({ name, label, color }) => {
        const state = agentStates[name] ?? { status: "pending" as AgentStatus, message: "" };
        const indicator = statusIndicators[state.status];

        return (
          <div
            key={name}
            className="flex items-center gap-1.5"
            title={state.message || label}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${indicator.className}`}
            />
            <span
              className="text-xs font-medium"
              style={{ color }}
            >
              {label}
            </span>
            {state.status === "complete" && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-500"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {state.status === "error" && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
