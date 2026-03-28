"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/header";
import { SplitPanelLayout } from "@/components/split-panel-layout";
import { CartView } from "@/components/cart-view";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { AgentActivityFeed } from "@/components/agent-activity-feed";
import { InputBar } from "@/components/input-bar";
import { DAGVisualization } from "@/components/dag-visualization";
import { PipelineView } from "@/components/pipeline-view";
import { MealPlanSummary } from "@/components/meal-plan-summary";
import { useOrchestration } from "@/hooks/use-orchestration";

export default function Home() {
  const [isTransparencyMode, setIsTransparencyMode] = useState(true);
  const [rightTab, setRightTab] = useState<"pipeline" | "feed">("pipeline");

  const {
    agentStates,
    activityLog,
    cartSummary,
    isRunning,
    error,
    demoMode,
    setDemoMode,
    orchestrate,
    reset,
  } = useOrchestration();

  // Extract meal plan data from activity log (meal-planner SUGGEST events)
  const mealPlanData = useMemo(() => {
    const mealEvents = activityLog.filter(
      (e) => e.agent === "meal-planner" && e.action === "SUGGEST"
    );
    return mealEvents.map((e) => {
      // Parse "Monday: Pasta Carbonara -- adding spinach + eggs + penne"
      const colonIdx = e.message.indexOf(":");
      const day = colonIdx > -1 ? e.message.slice(0, colonIdx).trim() : "Day";
      const rest = colonIdx > -1 ? e.message.slice(colonIdx + 1).trim() : e.message;
      const dashIdx = rest.indexOf("--");
      const mealName = dashIdx > -1 ? rest.slice(0, dashIdx).trim() : rest.trim();
      // Count ingredients mentioned after "adding"
      const addingIdx = rest.toLowerCase().indexOf("adding");
      let ingredientCount = 0;
      if (addingIdx > -1) {
        const ingredientStr = rest.slice(addingIdx + 6).trim();
        // Split by " + " or ", " to count
        ingredientCount = ingredientStr.split(/\s*[+,]\s*/).filter(Boolean).length;
      }
      // Estimate cost from cart items with recipe tag for this meal if available
      const estimatedCost = ingredientCount * 250; // rough estimate: 250 cents per ingredient
      return { day, mealName, ingredientCount, estimatedCost };
    });
  }, [activityLog]);

  const pipelineStatus = isRunning
    ? "Agents working..."
    : cartSummary
      ? "Pipeline complete"
      : "Ready";

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Header
        isTransparencyMode={isTransparencyMode}
        onToggleMode={() => setIsTransparencyMode((prev) => !prev)}
        pipelineStatus={pipelineStatus}
        demoMode={demoMode}
        onToggleDemo={() => {
          reset();
          setDemoMode((prev) => !prev);
        }}
      />
      <SplitPanelLayout
        isRightPanelVisible={isTransparencyMode}
        leftPanel={
          <div className="flex h-full flex-col">
            {/* Meal plan summary (above cart) */}
            {mealPlanData.length > 0 && (
              <MealPlanSummary meals={mealPlanData} />
            )}
            <div className="flex-1 overflow-hidden">
              {cartSummary ? (
                <CartView summary={cartSummary} isRunning={isRunning} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                  <div className="rounded-full bg-[var(--picnic-red-light)] p-5">
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--picnic-red)]"
                    >
                      <circle cx="8" cy="21" r="1" />
                      <circle cx="19" cy="21" r="1" />
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    Tell us about your week
                  </p>
                  <p className="max-w-xs text-sm text-[var(--text-muted)]">
                    Describe your plans and we will put together a smart grocery list for you.
                  </p>
                </div>
              )}
            </div>

            {/* Delivery info */}
            {cartSummary?.deliverySlot && !isRunning && (
              <div className="shrink-0 border-t border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-2.5">
                <p className="text-xs text-[var(--text-secondary)]">
                  Delivery: {cartSummary.deliverySlot.timeWindow} — {cartSummary.deliverySlot.date}
                </p>
              </div>
            )}

            {/* Input bar */}
            <InputBar
              onSubmit={orchestrate}
              isRunning={isRunning}
              onReset={reset}
              showReset={!!(cartSummary || activityLog.length > 0)}
            />

            {/* Error display */}
            {error && (
              <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">
                  Something went wrong
                </p>
                <p className="mt-0.5 text-sm text-red-600">{error}</p>
                {!demoMode && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Check that OPENAI_API_KEY, PICNIC_EMAIL, and PICNIC_PASSWORD are set in your .env file. You can also try demo mode using the toggle in the header.
                  </p>
                )}
              </div>
            )}
          </div>
        }
        rightPanel={
          <div className="flex h-full flex-col">
            {/* Tab switcher */}
            <div className="flex shrink-0 border-b border-[var(--border-light)]">
              <button
                onClick={() => setRightTab("pipeline")}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  rightTab === "pipeline"
                    ? "border-b-2 border-[var(--agent-orchestrator)] text-[var(--agent-orchestrator)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                How It Works
              </button>
              <button
                onClick={() => setRightTab("feed")}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  rightTab === "feed"
                    ? "border-b-2 border-[var(--agent-orchestrator)] text-[var(--agent-orchestrator)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Activity Feed
                {activityLog.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--surface-muted)] px-1 text-[10px] font-medium text-[var(--text-secondary)]">
                    {activityLog.length}
                  </span>
                )}
              </button>
            </div>

            {rightTab === "pipeline" ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                <DAGVisualization agentStates={agentStates} />
                <div className="flex-1 overflow-hidden">
                  <PipelineView agentStates={agentStates} activityLog={activityLog} />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <AgentStatusPanel agentStates={agentStates} />
                <div className="flex-1 overflow-hidden">
                  <AgentActivityFeed events={activityLog} />
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
