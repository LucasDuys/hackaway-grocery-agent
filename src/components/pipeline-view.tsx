"use client";

import { useState, useMemo } from "react";
import type { AgentName, AgentStatus, AgentEvent } from "@/types";

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
    agentStates: Record<AgentName, { status: AgentStatus; message: string }>,
    events: AgentEvent[]
  ) => string[];
}

interface PipelineViewProps {
  agentStates: Record<AgentName, { status: AgentStatus; message: string }>;
  activityLog: AgentEvent[];
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
  agentStates: Record<AgentName, { status: AgentStatus; message: string }>
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

/* ------------------------------------------------------------------ */
/*  Timeline Bar                                                       */
/* ------------------------------------------------------------------ */

function TimelineBar({
  steps,
  agentStates,
}: {
  steps: PipelineStep[];
  agentStates: Record<AgentName, { status: AgentStatus; message: string }>;
}) {
  const stepStatuses = steps.map((s) => deriveStepStatus(s, agentStates));
  const completedCount = stepStatuses.filter((s) => s === "complete").length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="shrink-0 border-b border-[var(--border-light)] px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Pipeline Progress
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
}: {
  step: PipelineStep;
  status: AgentStatus;
  summaryLines: string[];
  detailEvents: AgentEvent[];
}) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    pending: {
      label: "PENDING",
      bg: "bg-gray-100",
      text: "text-gray-500",
      border: "border-gray-200",
      dot: "bg-gray-300",
    },
    running: {
      label: "RUNNING",
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      dot: "bg-blue-500 animate-pulse",
    },
    complete: {
      label: "COMPLETE",
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
      dot: "bg-green-500",
    },
    error: {
      label: "ERROR",
      bg: "bg-red-50",
      text: "text-red-600",
      border: "border-red-200",
      dot: "bg-red-500",
    },
  };

  const cfg = statusConfig[status];

  return (
    <div
      className={`
        rounded-xl border transition-all duration-300
        ${status === "pending" ? "border-[var(--border-light)] bg-[var(--surface-muted)] opacity-60" : "border-[var(--border)] bg-white shadow-sm"}
        ${status === "running" ? "ring-1 ring-blue-200" : ""}
      `}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {/* Step number */}
        <div
          className={`
            flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold
            ${status === "complete" ? "bg-[var(--agent-orchestrator)] text-white" : ""}
            ${status === "running" ? "bg-blue-100 text-blue-700" : ""}
            ${status === "pending" ? "bg-gray-100 text-gray-400" : ""}
            ${status === "error" ? "bg-red-100 text-red-600" : ""}
          `}
        >
          {step.number}
        </div>

        {/* Title + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {step.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.bg} ${cfg.text}`}
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
        <div className="border-t border-[var(--border-light)] px-5 py-3">
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
/*  Main PipelineView                                                  */
/* ------------------------------------------------------------------ */

export function PipelineView({ agentStates, activityLog }: PipelineViewProps) {
  const stepsWithData = useMemo(
    () =>
      pipelineSteps.map((step) => ({
        step,
        status: deriveStepStatus(step, agentStates),
        summaryLines: step.summarize(agentStates, activityLog),
        detailEvents: activityLog.filter((e) =>
          step.agents.includes(e.agent)
        ),
      })),
    [agentStates, activityLog]
  );

  return (
    <div className="flex h-full flex-col">
      <TimelineBar steps={pipelineSteps} agentStates={agentStates} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-3">
          {stepsWithData.map(({ step, status, summaryLines, detailEvents }) => (
            <StepCard
              key={step.id}
              step={step}
              status={status}
              summaryLines={summaryLines}
              detailEvents={detailEvents}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
