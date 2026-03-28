"use client";

import type { ReasonTag, AgentName } from "@/types";

const tagConfig: Record<ReasonTag, { label: string; className: string }> = {
  repeat: {
    label: "repeat",
    className: "border-stone-200 text-stone-500 bg-stone-50/60",
  },
  substitution: {
    label: "swap",
    className: "border-amber-200 text-amber-600 bg-amber-50/60",
  },
  recipe: {
    label: "recipe",
    className: "border-sky-200 text-sky-600 bg-sky-50/60",
  },
  suggestion: {
    label: "idea",
    className: "border-violet-200 text-violet-500 bg-violet-50/60",
  },
  overdue: {
    label: "overdue",
    className: "border-orange-200 text-orange-500 bg-orange-50/60",
  },
  "co-purchase": {
    label: "goes with",
    className: "border-emerald-200 text-emerald-500 bg-emerald-50/60",
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
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight ${config.className}`}
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
