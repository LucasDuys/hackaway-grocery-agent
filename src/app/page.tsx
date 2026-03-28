"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/header";
import { SplitPanelLayout } from "@/components/split-panel-layout";
import { CartView } from "@/components/cart-view";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { AgentActivityFeed } from "@/components/agent-activity-feed";
import { InputBar } from "@/components/input-bar";
import { StreamedText } from "@/components/streamed-text";
import { DAGVisualization } from "@/components/dag-visualization";
import { MealPlanSummary } from "@/components/meal-plan-summary";
import { useOrchestration } from "@/hooks/use-orchestration";

export default function Home() {
  const [isTransparencyMode, setIsTransparencyMode] = useState(true);

  const {
    agentStates,
    activityLog,
    cartSummary,
    streamedText,
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
                <CartView summary={cartSummary} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                  <div className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--text-muted)]"
                    >
                      <circle cx="8" cy="21" r="1" />
                      <circle cx="19" cy="21" r="1" />
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Your cart is empty
                  </p>
                  <p className="max-w-xs text-xs text-[var(--text-muted)]">
                    Describe your week below and the agents will build a smart grocery cart for you.
                  </p>
                </div>
              )}
            </div>

            {/* Streamed explanation text */}
            <StreamedText text={streamedText} isRunning={isRunning} />

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
            <DAGVisualization agentStates={agentStates} />
            <AgentStatusPanel agentStates={agentStates} />
            <div className="flex-1 overflow-hidden">
              <AgentActivityFeed events={activityLog} />
            </div>
          </div>
        }
      />
    </div>
  );
}
