"use client";

import { useState, useMemo } from "react";
import type { AgentName, AgentStatus, AgentEvent, AgentHandoff } from "@/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PipelineStep {
  id: string;
  number: number;
  title: string;
  /** Which agents map to this step */
  agents: AgentName[];
  /** Derive summary from activity log */
  summarize: (
    agentStates: Record<AgentName, { status: AgentStatus; message: string; durationMs?: number }>,
    events: AgentEvent[]
  ) => string[];
}

interface PipelineViewProps {
  agentStates: Record<AgentName, { status: AgentStatus; message: string; durationMs?: number }>;
  activityLog: AgentEvent[];
  handoffs?: AgentHandoff[];
  learningInsights?: string[];
  totalDuration?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ------------------------------------------------------------------ */
/*  Pipeline step definitions                                          */
/* ------------------------------------------------------------------ */

const pipelineSteps: PipelineStep[] = [
  {
    id: "parse",
    number: 1,
    title: "Parse Intent",
    agents: ["prefetch"],
    summarize: (states, events) => {
      const prefetchEvents = events.filter((e) => e.agent === "prefetch");
      if (prefetchEvents.length === 0) return ["Waiting for user input..."];
      return prefetchEvents.map((e) => e.message);
    },
  },
  {
    id: "fetch",
    number: 2,
    title: "Fetch Data",
    agents: ["prefetch"],
    summarize: (states, events) => {
      const queryEvents = events.filter(
        (e) => e.agent === "prefetch" && e.action === "QUERY"
      );
      if (queryEvents.length === 0) return ["Waiting for data fetch..."];
      return queryEvents.map((e) => e.message);
    },
  },
  {
    id: "agents",
    number: 3,
    title: "Agent Pipeline",
    agents: ["order-analyst", "meal-planner", "schedule-agent"],
    summarize: (states, events) => {
      const lines: string[] = [];
      const analysts: AgentName[] = [
        "order-analyst",
        "meal-planner",
        "schedule-agent",
      ];
      for (const agent of analysts) {
        const agentEvents = events.filter((e) => e.agent === agent);
        const state = states[agent];
        const label =
          agent === "order-analyst"
            ? "Order Analyst"
            : agent === "meal-planner"
              ? "Meal Planner"
              : "Schedule Agent";
        if (state?.status === "complete") {
          lines.push(`[${label}] ${state.message} (${agentEvents.length} events)`);
        } else if (state?.status === "running") {
          lines.push(`[${label}] ${state.message}...`);
        } else if (agentEvents.length > 0) {
          lines.push(`[${label}] ${agentEvents.length} events logged`);
        }
      }
      if (lines.length === 0) return ["Waiting for agents to start..."];
      return lines;
    },
  },
  {
    id: "budget",
    number: 4,
    title: "Budget Check",
    agents: ["budget-optimizer"],
    summarize: (states, events) => {
      const budgetEvents = events.filter(
        (e) => e.agent === "budget-optimizer"
      );
      if (budgetEvents.length === 0) return ["Waiting for budget check..."];
      return budgetEvents.map((e) => {
        const prefix =
          e.action === "REJECT"
            ? "[Over budget]"
            : e.action === "SUBSTITUTE"
              ? "[Substitution]"
              : "[Approved]";
        return `${prefix} ${e.message}`;
      });
    },
  },
  {
    id: "assemble",
    number: 5,
    title: "Cart Assembly",
    agents: ["orchestrator"],
    summarize: (states, events) => {
      const orchEvents = events.filter((e) => e.agent === "orchestrator");
      if (orchEvents.length === 0) return ["Waiting for cart finalization..."];
      return orchEvents.map((e) => e.message);
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Step status derivation                                             */
/* ------------------------------------------------------------------ */

function deriveStepStatus(
  step: PipelineStep,
  agentStates: Record<AgentName, { status: AgentStatus; message: string; durationMs?: number }>
): AgentStatus {
  const statuses = step.agents.map(
    (a) => agentStates[a]?.status ?? "pending"
  );
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.every((s) => s === "complete")) return "complete";
  if (statuses.some((s) => s === "running" || s === "complete"))
    return "running";
  return "pending";
}

/**
 * Derive the duration for a pipeline step by taking the max duration
 * across all agents in the step (since parallel agents overlap).
 */
function deriveStepDuration(
  step: PipelineStep,
  agentStates: Record<AgentName, { status: AgentStatus; message: string; durationMs?: number }>
): number | undefined {
  const durations = step.agents
    .map((a) => agentStates[a]?.durationMs)
    .filter((d): d is number => d !== undefined);
  if (durations.length === 0) return undefined;
  return Math.max(...durations);
}

/* ------------------------------------------------------------------ */
/*  Timeline Bar                                                       */
/* ------------------------------------------------------------------ */

function TimelineBar({
  steps,
  agentStates,
  totalDuration,
}: {
  steps: PipelineStep[];
  agentStates: Record<AgentName, { status: AgentStatus; message: string; durationMs?: number }>;
  totalDuration?: number | null;
}) {
  const stepStatuses = steps.map((s) => deriveStepStatus(s, agentStates));
  const completedCount = stepStatuses.filter((s) => s === "complete").length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="pipeline-timeline shrink-0 border-b border-[var(--border-light)] px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Pipeline Progress
          {totalDuration != null && (
            <span className="ml-2 font-normal normal-case text-[var(--text-secondary)]">
              Total: {formatDuration(totalDuration)}
            </span>
          )}
        </span>
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {completedCount} / {steps.length} steps
        </span>
      </div>

      {/* Track */}
      <div className="relative flex items-center">
        {/* Background bar */}
        <div className="absolute left-0 right-0 h-1 rounded-full bg-[var(--border)]" />
        {/* Progress fill */}
        <div
          className="absolute left-0 h-1 rounded-full bg-[var(--agent-orchestrator)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />

        {/* Step dots */}
        <div className="relative flex w-full justify-between">
          {steps.map((step, i) => {
            const status = stepStatuses[i];
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`
                    relative z-10 flex h-6 w-6 items-center justify-center rounded-full
                    border-2 text-[10px] font-bold transition-all duration-300
                    ${
                      status === "complete"
                        ? "border-[var(--agent-orchestrator)] bg-[var(--agent-orchestrator)] text-white"
                        : status === "running"
                          ? "border-[var(--agent-orchestrator)] bg-white text-[var(--agent-orchestrator)] pipeline-dot-pulse"
                          : status === "error"
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-[var(--border)] bg-white text-[var(--text-muted)]"
                    }
                  `}
                >
                  {status === "complete" ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span className="mt-1.5 text-[10px] font-medium text-[var(--text-muted)] whitespace-nowrap">
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Step Card                                                 */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  status,
  summaryLines,
  detailEvents,
  durationMs,
}: {
  step: PipelineStep;
  status: AgentStatus;
  summaryLines: string[];
  detailEvents: AgentEvent[];
  durationMs?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    pending: {
      label: "PENDING",
      pillBg: "bg-gray-50",
      pillText: "text-gray-500",
      dot: "bg-gray-300",
      leftBorder: "border-l-gray-300",
      numberBg: "bg-gray-100",
      numberText: "text-gray-400",
    },
    running: {
      label: "RUNNING",
      pillBg: "bg-blue-50",
      pillText: "text-blue-600",
      dot: "bg-blue-500 animate-pulse",
      leftBorder: "border-l-blue-500",
      numberBg: "bg-blue-50",
      numberText: "text-blue-600",
    },
    complete: {
      label: "COMPLETE",
      pillBg: "bg-green-50",
      pillText: "text-green-700",
      dot: "bg-green-500",
      leftBorder: "border-l-green-500",
      numberBg: "bg-green-50",
      numberText: "text-green-700",
    },
    error: {
      label: "ERROR",
      pillBg: "bg-red-50",
      pillText: "text-red-600",
      dot: "bg-red-500",
      leftBorder: "border-l-red-500",
      numberBg: "bg-red-50",
      numberText: "text-red-600",
    },
  };

  const cfg = statusConfig[status];

  return (
    <div
      className={`
        rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]
        border-l-4 ${cfg.leftBorder}
        transition-all duration-300
        ${status === "pending" ? "opacity-60" : ""}
        ${status === "running" ? "pipeline-card-pulse" : ""}
      `}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="pipeline-step-header flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {/* Step number */}
        <div
          className={`
            flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
            ${cfg.numberBg} ${cfg.numberText}
          `}
        >
          {step.number}
        </div>

        {/* Title + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {step.title}
              {status === "complete" && durationMs != null && (
                <span className="ml-1.5 font-normal text-xs text-[var(--text-muted)]">
                  -- {formatDuration(durationMs)}
                </span>
              )}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.pillBg} ${cfg.pillText}`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          {status !== "pending" && summaryLines.length > 0 && (
            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
              {summaryLines[0]}
              {summaryLines.length > 1 && ` (+${summaryLines.length - 1} more)`}
            </p>
          )}
        </div>

        {/* Expand arrow */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="pipeline-step-detail border-t border-[var(--border-light)] px-5 py-3">
          <div className="space-y-1.5">
            {summaryLines.map((line, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">--</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
          {detailEvents.length > 0 && (
            <div className="mt-3 border-t border-[var(--border-light)] pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Agent Events
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {detailEvents.map((evt, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                      {evt.action}
                    </span>
                    <span className="text-[var(--text-secondary)]">{evt.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Handoff Connector                                                  */
/* ------------------------------------------------------------------ */

function HandoffConnector({ handoff }: { handoff: AgentHandoff }) {
  return (
    <div className="flex items-center gap-2 px-8 py-1 animate-in fade-in duration-500">
      <div className="flex flex-1 items-center gap-2">
        {/* Vertical connecting line + arrow */}
        <div className="flex flex-col items-center">
          <div className="h-2 w-px bg-gray-300" />
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400"
          >
            <polyline points="6 3 12 9 18 3" />
          </svg>
          <div className="h-2 w-px bg-gray-300" />
        </div>
        {/* Summary text */}
        <span className="text-[11px] leading-tight text-gray-400">
          {handoff.summary}
        </span>
      </div>
    </div>
  );
}



/* ------------------------------------------------------------------ */
/*  Learning Insights Card                                             */
/* ------------------------------------------------------------------ */

function LearningInsightsCard({ insights }: { insights: string[] }) {
  return (
    <div
      className="
        rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]
        border-l-4 border-l-purple-500
        animate-in fade-in slide-in-from-bottom-2 duration-500
      "
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-xs font-bold text-purple-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">What I learned</h3>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-purple-50 text-purple-700">
            Memory
          </span>
        </div>
        <div className="space-y-1.5">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
              <span className="mt-0.5 shrink-0 text-purple-400">--</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main PipelineView                                                  */
/* ------------------------------------------------------------------ */

/**
 * Map an agent name to the index of the pipeline step it belongs to.
 */
function agentToStepIndex(agent: AgentName): number {
  const idx = pipelineSteps.findIndex((s) => s.agents.includes(agent));
  return idx >= 0 ? idx : -1;
}

export function PipelineView({ agentStates, activityLog, handoffs = [], learningInsights = [], totalDuration }: PipelineViewProps) {
  const stepsWithData = useMemo(
    () =>
      pipelineSteps.map((step) => ({
        step,
        status: deriveStepStatus(step, agentStates),
        summaryLines: step.summarize(agentStates, activityLog),
        detailEvents: activityLog.filter((e) =>
          step.agents.includes(e.agent)
        ),
        durationMs: deriveStepDuration(step, agentStates),
      })),
    [agentStates, activityLog]
  );

  // Group handoffs by the step index of their "from" agent so we can
  // render them between the correct step cards.
  const handoffsByStepIndex = useMemo(() => {
    const map = new Map<number, AgentHandoff[]>();
    for (const h of handoffs) {
      const idx = agentToStepIndex(h.from);
      if (idx < 0) continue;
      const list = map.get(idx) ?? [];
      list.push(h);
      map.set(idx, list);
    }
    return map;
  }, [handoffs]);

  return (
    <div className="flex h-full flex-col">
      <TimelineBar steps={pipelineSteps} agentStates={agentStates} totalDuration={totalDuration} />
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-lg space-y-2 sm:space-y-3">
          {stepsWithData.map(({ step, status, summaryLines, detailEvents, durationMs }, i) => (
            <div key={step.id}>
              <StepCard
                step={step}
                status={status}
                summaryLines={summaryLines}
                detailEvents={detailEvents}
                durationMs={durationMs}
              />
              {/* Render handoff connectors after this step card */}
              {handoffsByStepIndex.get(i)?.map((h, j) => (
                <HandoffConnector key={`${h.from}-${h.to}-${j}`} handoff={h} />
              ))}
            </div>
          ))}
          {learningInsights.length > 0 && (
            <LearningInsightsCard insights={learningInsights} />
          )}
        </div>
      </div>
    </div>
  );
}
