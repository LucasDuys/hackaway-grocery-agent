"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentName,
  AgentStatus,
  AgentEvent,
  AgentHandoff,
  CartSummary,
  ActionType,
} from "@/types";

const DEFAULT_DEMO_MODE = false;

type AgentStates = Record<AgentName, { status: AgentStatus; message: string }>;

const initialAgentStates: AgentStates = {
  prefetch: { status: "pending", message: "" },
  "order-analyst": { status: "pending", message: "" },
  "meal-planner": { status: "pending", message: "" },
  "budget-optimizer": { status: "pending", message: "" },
  "schedule-agent": { status: "pending", message: "" },
  orchestrator: { status: "pending", message: "" },
};

// -- Demo data --

interface DemoStep {
  delay: number;
  agentStatus?: { agent: AgentName; status: AgentStatus; message: string };
  event?: { agent: AgentName; action: ActionType; message: string };
}

const demoSteps: DemoStep[] = [
  // Phase 1: prefetch
  { delay: 300, agentStatus: { agent: "prefetch", status: "running", message: "Fetching Picnic data..." } },
  { delay: 600, event: { agent: "prefetch", action: "QUERY", message: "Loading order history (12 orders)" } },
  { delay: 400, event: { agent: "prefetch", action: "QUERY", message: "Loading favorites and delivery slots" } },
  { delay: 500, agentStatus: { agent: "prefetch", status: "complete", message: "Data ready" } },

  // Phase 2: parallel agents start
  { delay: 300, agentStatus: { agent: "order-analyst", status: "running", message: "Analyzing order patterns..." } },
  { delay: 100, agentStatus: { agent: "meal-planner", status: "running", message: "Planning meals..." } },
  { delay: 100, agentStatus: { agent: "schedule-agent", status: "running", message: "Finding delivery slot..." } },

  // Order analyst events
  { delay: 700, event: { agent: "order-analyst", action: "SUGGEST", message: "Organic Bananas -- bought in 8/10 orders" } },
  { delay: 400, event: { agent: "order-analyst", action: "SUGGEST", message: "Cherry Tomatoes 500g -- weekly staple" } },
  { delay: 350, event: { agent: "order-analyst", action: "SUGGEST", message: "Semi-Skimmed Milk 1L (x2) -- bought weekly" } },
  { delay: 300, event: { agent: "order-analyst", action: "SUGGEST", message: "Greek Yogurt 500g -- overdue (3 weeks ago)" } },
  { delay: 250, event: { agent: "order-analyst", action: "SUGGEST", message: "Sourdough Bread -- co-purchased with olive oil" } },

  // Meal planner events
  { delay: 200, event: { agent: "meal-planner", action: "SUGGEST", message: "Monday: Pasta Carbonara -- adding spinach + eggs + penne" } },
  { delay: 500, event: { agent: "meal-planner", action: "SUGGEST", message: "Wednesday: Chicken Stir-Fry -- adding chicken breast (x2)" } },
  { delay: 400, event: { agent: "meal-planner", action: "SUGGEST", message: "Friday: Salmon with roasted vegetables" } },

  // Schedule agent completes
  { delay: 300, event: { agent: "schedule-agent", action: "APPROVE", message: "Selected Monday 18:00-20:00 -- matches usual evening slot" } },
  { delay: 200, agentStatus: { agent: "schedule-agent", status: "complete", message: "Slot selected" } },

  // Analysts complete
  { delay: 400, agentStatus: { agent: "order-analyst", status: "complete", message: "8 items recommended" } },
  { delay: 300, agentStatus: { agent: "meal-planner", status: "complete", message: "3 meals planned" } },

  // Phase 3: Budget optimizer
  { delay: 400, agentStatus: { agent: "budget-optimizer", status: "running", message: "Checking budget..." } },
  { delay: 600, event: { agent: "budget-optimizer", action: "REJECT", message: "Cart total EUR 65.45 exceeds weekly average EUR 55.00" } },
  { delay: 500, event: { agent: "budget-optimizer", action: "SUBSTITUTE", message: "Wild Salmon (EUR 11.49) -> Premium Salmon Fillet (EUR 7.99) -- saves EUR 3.50" } },
  { delay: 400, event: { agent: "budget-optimizer", action: "APPROVE", message: "Optimized total: EUR 61.45 -- within budget" } },
  { delay: 300, agentStatus: { agent: "budget-optimizer", status: "complete", message: "1 substitution, EUR 3.50 saved" } },

  // Phase 4: Orchestrator
  { delay: 400, agentStatus: { agent: "orchestrator", status: "running", message: "Finalizing cart..." } },
  { delay: 500, event: { agent: "orchestrator", action: "APPROVE", message: "Cart finalized: 13 items, EUR 61.45, delivery Monday 18:00-20:00" } },
  { delay: 300, agentStatus: { agent: "orchestrator", status: "complete", message: "Done" } },
];

const demoCartSummary: CartSummary = {
  items: [
    { itemId: "s1001", name: "Organic Bananas", quantity: 6, price: 39, reasonTag: "repeat", reasoning: "Bought in 8 of last 10 orders", agentSource: "order-analyst", diffStatus: "unchanged" },
    { itemId: "s1002", name: "Cherry Tomatoes 500g", quantity: 2, price: 189, reasonTag: "repeat", reasoning: "Weekly staple", agentSource: "order-analyst", diffStatus: "unchanged" },
    { itemId: "s1003", name: "Avocado (3 pack)", quantity: 1, price: 299, reasonTag: "suggestion", reasoning: "Often bought with tomatoes", agentSource: "order-analyst", diffStatus: "added" },
    { itemId: "s1004", name: "Baby Spinach 200g", quantity: 1, price: 179, reasonTag: "recipe", reasoning: "Needed for Pasta Carbonara", agentSource: "meal-planner", diffStatus: "added" },
    { itemId: "s1005", name: "Semi-Skimmed Milk 1L", quantity: 2, price: 129, reasonTag: "repeat", reasoning: "Bought weekly", agentSource: "order-analyst", diffStatus: "unchanged" },
    { itemId: "s1006", name: "Free-Range Eggs (10)", quantity: 1, price: 349, reasonTag: "recipe", reasoning: "Needed for Carbonara + breakfast", agentSource: "meal-planner", diffStatus: "unchanged" },
    { itemId: "s1007", name: "Greek Yogurt 500g", quantity: 1, price: 219, reasonTag: "overdue", reasoning: "Last bought 3 weeks ago (usually weekly)", agentSource: "order-analyst", diffStatus: "added" },
    { itemId: "s1008", name: "Chicken Breast 500g", quantity: 2, price: 549, reasonTag: "recipe", reasoning: "Chicken stir-fry (Wednesday)", agentSource: "meal-planner", diffStatus: "unchanged" },
    { itemId: "s1009", name: "Premium Salmon Fillet", quantity: 1, price: 799, reasonTag: "substitution", reasoning: "Replaced: Wild Salmon (EUR 11.49 -> EUR 7.99)", agentSource: "budget-optimizer", diffStatus: "substituted" },
    { itemId: "s1010", name: "Penne Pasta 500g", quantity: 2, price: 149, reasonTag: "recipe", reasoning: "Pasta Carbonara (Monday)", agentSource: "meal-planner", diffStatus: "unchanged" },
    { itemId: "s1011", name: "Extra Virgin Olive Oil 500ml", quantity: 1, price: 499, reasonTag: "repeat", reasoning: "Running low (last bought 4 weeks ago)", agentSource: "order-analyst", diffStatus: "unchanged" },
    { itemId: "s1012", name: "Sourdough Bread", quantity: 1, price: 349, reasonTag: "co-purchase", reasoning: "Often bought with olive oil and tomatoes", agentSource: "order-analyst", diffStatus: "added" },
    { itemId: "s1013", name: "Sparkling Water (6-pack)", quantity: 1, price: 399, reasonTag: "repeat", reasoning: "Bought every other week", agentSource: "order-analyst", diffStatus: "removed" },
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

export interface MealPlanCard {
  day: string;
  mealName: string;
  ingredientCount: number;
  estimatedCost: number;
  imageUrl?: string;
}

export function useOrchestration() {
  const [demoMode, setDemoMode] = useState(DEFAULT_DEMO_MODE);
  const [agentStates, setAgentStates] = useState<AgentStates>({ ...initialAgentStates });
  const [activityLog, setActivityLog] = useState<AgentEvent[]>([]);
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlanCard[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineMode, setPipelineMode] = useState<"auto" | "custom" | null>(null);
  const [handoffs, setHandoffs] = useState<AgentHandoff[]>([]);
  const [learningInsights, setLearningInsights] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const reset = useCallback(() => {
    // Cancel any in-flight work
    abortRef.current?.abort();
    abortRef.current = null;
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];

    setAgentStates({ ...initialAgentStates });
    setActivityLog([]);
    setCartSummary(null);
    setMealPlan([]);
    setHandoffs([]);
    setLearningInsights([]);
    setStreamedText("");
    setIsRunning(false);
    setError(null);
    setPipelineMode(null);
  }, []);

  const runDemo = useCallback((input: string) => {
    setIsRunning(true);
    setError(null);
    setActivityLog([]);
    setAgentStates({ ...initialAgentStates });
    setCartSummary(null);
    setStreamedText("");
    setPipelineMode("custom"); // demo always shows custom mode

    let cumulativeDelay = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const step of demoSteps) {
      cumulativeDelay += step.delay;
      const timer = setTimeout(() => {
        if (step.agentStatus) {
          setAgentStates((prev) => ({
            ...prev,
            [step.agentStatus!.agent]: {
              status: step.agentStatus!.status,
              message: step.agentStatus!.message,
            },
          }));
        }
        if (step.event) {
          const agentEvent: AgentEvent = {
            agent: step.event.agent,
            action: step.event.action,
            message: step.event.message,
            timestamp: Date.now(),
          };
          setActivityLog((prev) => [...prev, agentEvent]);
        }
      }, cumulativeDelay);
      timers.push(timer);
    }

    // Final step: set cart summary and streaming text
    cumulativeDelay += 500;
    const finalTimer = setTimeout(() => {
      setCartSummary(demoCartSummary);
      setStreamedText(
        `Based on your request "${input}", I've assembled a cart with 13 items totaling EUR 61.45. ` +
        "I included your usual staples, planned 3 meals for the week, and found a EUR 3.50 saving " +
        "by substituting Wild Salmon with Premium Salmon Fillet. Delivery is set for Monday 18:00-20:00."
      );
      setIsRunning(false);
    }, cumulativeDelay);
    timers.push(finalTimer);

    timersRef.current = timers;
  }, []);

  const runSSE = useCallback(async (input: string) => {
    setIsRunning(true);
    setError(null);
    setActivityLog([]);
    setAgentStates({ ...initialAgentStates });
    setCartSummary(null);
    setMealPlan([]);
    setHandoffs([]);
    setLearningInsights([]);
    setStreamedText("");
    setPipelineMode(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: input }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.type === "agent-status") {
              setAgentStates((prev) => ({
                ...prev,
                [parsed.data.agent]: {
                  status: parsed.data.status,
                  message: parsed.data.message,
                },
              }));
            } else if (parsed.type === "agent-event") {
              const agentEvent: AgentEvent = {
                agent: parsed.data.agent,
                action: parsed.data.action,
                message: parsed.data.message,
                rawMessage: parsed.data.rawMessage,
                timestamp: parsed.data.timestamp ?? Date.now(),
                details: parsed.data.details,
              };
              setActivityLog((prev) => [...prev, agentEvent]);
            } else if (parsed.type === "agent-handoff") {
              const handoff: AgentHandoff = {
                from: parsed.data.from,
                to: parsed.data.to,
                summary: parsed.data.summary,
              };
              setHandoffs((prev) => [...prev, handoff]);
            } else if (parsed.type === "mode") {
              setPipelineMode(parsed.data.mode);
            } else if (parsed.type === "meal-plan") {
              setMealPlan(parsed.data as MealPlanCard[]);
            } else if (parsed.type === "cart-summary") {
              setCartSummary(parsed.data);
            } else if (parsed.type === "streamed-text") {
              setStreamedText((prev) => prev + (parsed.data.text ?? ""));
            } else if (parsed.type === "learning-insights") {
              setLearningInsights(parsed.data?.insights ?? []);
            } else if (parsed.type === "error") {
              setError(parsed.data?.message ?? "Pipeline error");
            } else if (parsed.type === "done") {
              // Stream complete -- handled by the reader loop ending
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, []);

  const orchestrate = useCallback(
    (input: string) => {
      if (demoMode) {
        runDemo(input);
      } else {
        runSSE(input);
      }
    },
    [demoMode, runDemo, runSSE]
  );

  return {
    agentStates,
    activityLog,
    handoffs,
    cartSummary,
    mealPlan,
    streamedText,
    isRunning,
    error,
    demoMode,
    setDemoMode,
    pipelineMode,
    learningInsights,
    orchestrate,
    reset,
  };
}
