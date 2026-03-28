"use client";

import { useState } from "react";
import type { CartSummary } from "@/types";
import { Header } from "@/components/header";
import { SplitPanelLayout } from "@/components/split-panel-layout";
import { CartView } from "@/components/cart-view";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { AgentActivityFeed } from "@/components/agent-activity-feed";
import { useOrchestration } from "@/hooks/use-orchestration";

const mockCartSummary: CartSummary = {
  items: [
    {
      itemId: "s1001",
      name: "Organic Bananas",
      quantity: 6,
      price: 39,
      reasonTag: "repeat",
      reasoning: "Bought in 8 of last 10 orders",
      agentSource: "order-analyst",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1002",
      name: "Cherry Tomatoes 500g",
      quantity: 2,
      price: 189,
      reasonTag: "repeat",
      reasoning: "Weekly staple",
      agentSource: "order-analyst",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1003",
      name: "Avocado (3 pack)",
      quantity: 1,
      price: 299,
      reasonTag: "suggestion",
      reasoning: "Often bought with tomatoes",
      agentSource: "order-analyst",
      diffStatus: "added",
    },
    {
      itemId: "s1004",
      name: "Baby Spinach 200g",
      quantity: 1,
      price: 179,
      reasonTag: "recipe",
      reasoning: "Needed for Pasta Carbonara",
      agentSource: "meal-planner",
      diffStatus: "added",
    },
    {
      itemId: "s1005",
      name: "Semi-Skimmed Milk 1L",
      quantity: 2,
      price: 129,
      reasonTag: "repeat",
      reasoning: "Bought weekly",
      agentSource: "order-analyst",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1006",
      name: "Free-Range Eggs (10)",
      quantity: 1,
      price: 349,
      reasonTag: "recipe",
      reasoning: "Needed for Carbonara + breakfast",
      agentSource: "meal-planner",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1007",
      name: "Greek Yogurt 500g",
      quantity: 1,
      price: 219,
      reasonTag: "overdue",
      reasoning: "Last bought 3 weeks ago (usually weekly)",
      agentSource: "order-analyst",
      diffStatus: "added",
    },
    {
      itemId: "s1008",
      name: "Chicken Breast 500g",
      quantity: 2,
      price: 549,
      reasonTag: "recipe",
      reasoning: "Chicken stir-fry (Wednesday)",
      agentSource: "meal-planner",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1009",
      name: "Premium Salmon Fillet",
      quantity: 1,
      price: 799,
      reasonTag: "substitution",
      reasoning: "Replaced: Wild Salmon (EUR 11.49 -> EUR 7.99)",
      agentSource: "budget-optimizer",
      diffStatus: "substituted",
    },
    {
      itemId: "s1010",
      name: "Penne Pasta 500g",
      quantity: 2,
      price: 149,
      reasonTag: "recipe",
      reasoning: "Pasta Carbonara (Monday)",
      agentSource: "meal-planner",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1011",
      name: "Extra Virgin Olive Oil 500ml",
      quantity: 1,
      price: 499,
      reasonTag: "repeat",
      reasoning: "Running low (last bought 4 weeks ago)",
      agentSource: "order-analyst",
      diffStatus: "unchanged",
    },
    {
      itemId: "s1012",
      name: "Sourdough Bread",
      quantity: 1,
      price: 349,
      reasonTag: "co-purchase",
      reasoning: "Often bought with olive oil and tomatoes",
      agentSource: "order-analyst",
      diffStatus: "added",
    },
    {
      itemId: "s1013",
      name: "Sparkling Water (6-pack)",
      quantity: 1,
      price: 399,
      reasonTag: "repeat",
      reasoning: "Bought every other week",
      agentSource: "order-analyst",
      diffStatus: "removed",
    },
  ],
  totalCost: 6145,
  budget: 7500,
  isOverBudget: false,
  savings: 350,
  substitutionCount: 1,
  deliverySlot: {
    slotId: "slot-42",
    date: "2026-03-30",
    timeWindow: "18:00 - 20:00",
    reasoning: "Matches your usual Monday evening slot",
  },
};

export default function Home() {
  const [isTransparencyMode, setIsTransparencyMode] = useState(true);
  const [inputValue, setInputValue] = useState("");

  const {
    agentStates,
    activityLog,
    cartSummary,
    streamedText,
    isRunning,
    error,
    orchestrate,
    reset,
  } = useOrchestration();

  const displayCart = cartSummary ?? mockCartSummary;

  const pipelineStatus = isRunning
    ? "Agents working..."
    : cartSummary
      ? "Pipeline complete"
      : "Ready";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isRunning) return;
    orchestrate(trimmed);
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Header
        isTransparencyMode={isTransparencyMode}
        onToggleMode={() => setIsTransparencyMode((prev) => !prev)}
        pipelineStatus={pipelineStatus}
      />
      <SplitPanelLayout
        isRightPanelVisible={isTransparencyMode}
        leftPanel={
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
              <CartView summary={displayCart} />
            </div>

            {/* Streamed explanation text */}
            {streamedText && (
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  {streamedText}
                </p>
              </div>
            )}

            {/* Input bar */}
            <form
              onSubmit={handleSubmit}
              className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Tell me about your week (e.g. 'Pasta Monday, guests Friday, keep it under 60 euros')"
                disabled={isRunning}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--picnic-orange)] focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isRunning || !inputValue.trim()}
                className="rounded-lg bg-[var(--picnic-orange)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {isRunning ? "Running..." : "Go"}
              </button>
              {(cartSummary || activityLog.length > 0) && !isRunning && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                  Reset
                </button>
              )}
            </form>

            {/* Error display */}
            {error && (
              <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        }
        rightPanel={
          <div className="flex h-full flex-col">
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
