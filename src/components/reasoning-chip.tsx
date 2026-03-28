"use client";

import type { ReasonTag, AgentName } from "@/types";

const tagConfig: Record<ReasonTag, { label: string; className: string }> = {
  repeat: {
    label: "repeat",
    className: "border-stone-300 text-stone-600 bg-stone-50",
  },
  substitution: {
    label: "substitution",
    className: "border-yellow-400 text-yellow-700 bg-yellow-50",
  },
  recipe: {
    label: "recipe",
    className: "border-sky-300 text-sky-700 bg-sky-50",
  },
  suggestion: {
    label: "suggestion",
    className: "border-violet-300 text-violet-700 bg-violet-50",
  },
  overdue: {
    label: "overdue",
    className: "border-orange-300 text-orange-700 bg-orange-50",
  },
  "co-purchase": {
    label: "co-purchase",
    className: "border-emerald-300 text-emerald-700 bg-emerald-50",
  },
};

const agentDotColor: Record<AgentName, string> = {
  prefetch: "bg-indigo-500",
  "order-analyst": "bg-indigo-500",
  "meal-planner": "bg-violet-500",
  "budget-optimizer": "bg-amber-500",
  "schedule-agent": "bg-sky-500",
  orchestrator: "bg-emerald-500",
};

interface ReasoningChipProps {
  tag: ReasonTag;
  agentSource?: AgentName;
}

export function ReasoningChip({ tag, agentSource }: ReasoningChipProps) {
  const config = tagConfig[tag];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {agentSource && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${agentDotColor[agentSource]}`}
        />
      )}
      {config.label}
    </span>
  );
}
