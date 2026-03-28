"use client";

import type { AgentEvent, ActionType, AgentName } from "@/types";

const agentColorMap: Record<string, string> = {
  "order-analyst": "var(--agent-order-analyst)",
  "meal-planner": "var(--agent-meal-planner)",
  "schedule-agent": "var(--agent-schedule)",
  "budget-optimizer": "var(--agent-budget)",
  orchestrator: "var(--agent-orchestrator)",
  prefetch: "var(--text-secondary)",
};

const actionBadgeColors: Record<ActionType, { bg: string; text: string }> = {
  SUGGEST: { bg: "#dbeafe", text: "#1d4ed8" },
  REJECT: { bg: "#fee2e2", text: "#dc2626" },
  APPROVE: { bg: "#dcfce7", text: "#16a34a" },
  QUERY: { bg: "#f3f4f6", text: "#6b7280" },
  SUBSTITUTE: { bg: "#fef9c3", text: "#a16207" },
};

function formatAgentName(name: AgentName): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface FeedEntryProps {
  event: AgentEvent;
}

export function FeedEntry({ event }: FeedEntryProps) {
  const agentColor = agentColorMap[event.agent] ?? "var(--text-secondary)";
  const badge = actionBadgeColors[event.action];

  return (
    <div className="feed-entry flex items-start gap-2 rounded-md px-3 py-2 text-sm">
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
        {formatTimestamp(event.timestamp)}
      </span>

      {/* Agent name */}
      <span
        className="shrink-0 font-semibold text-xs"
        style={{ color: agentColor }}
      >
        {formatAgentName(event.agent)}
      </span>

      {/* Action badge */}
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight"
        style={{ backgroundColor: badge.bg, color: badge.text }}
      >
        {event.action}
      </span>

      {/* Message */}
      <span className="text-[var(--text-primary)]">{event.message}</span>
    </div>
  );
}
