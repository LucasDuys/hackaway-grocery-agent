"use client";

import { useState } from "react";
import type { CartSummary } from "@/types";
import { Header } from "@/components/header";
import { SplitPanelLayout } from "@/components/split-panel-layout";
import { CartView } from "@/components/cart-view";

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

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <Header
        isTransparencyMode={isTransparencyMode}
        onToggleMode={() => setIsTransparencyMode((prev) => !prev)}
        pipelineStatus="Pipeline complete"
      />
      <SplitPanelLayout
        isRightPanelVisible={isTransparencyMode}
        leftPanel={<CartView summary={mockCartSummary} />}
        rightPanel={
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-[var(--text-secondary)]">
                Agent Reasoning Feed
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Will be implemented in T006
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}
