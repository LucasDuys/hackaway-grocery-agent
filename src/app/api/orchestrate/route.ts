import { streamText } from "ai";
import { parseIntent } from "@/lib/agents/intent-parser";
import { runOrderAnalyst } from "@/lib/agents/order-analyst";
import { runMealPlanner } from "@/lib/agents/meal-planner";
import { runScheduleAgent } from "@/lib/agents/schedule-agent";
import { prefetchAll } from "@/lib/picnic/prefetch";
import { runFullAnalysis } from "@/lib/analysis";
import { buildOrchestratorPrompt } from "@/lib/prompts/orchestrator";
import { getModel } from "@/lib/ai/models";
import type {
  CartItem,
  CartSummary,
  BudgetOptimizerOutput,
  OrderAnalystOutput,
  MealPlannerOutput,
  AgentName,
  AgentStatus,
  ActionType,
} from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// SSE helpers -- matches the { type, data } wrapper format expected by
// src/hooks/use-orchestration.ts (see runSSE handler)
// ---------------------------------------------------------------------------

type SSESend = (data: unknown) => void;

function makeSend(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): SSESend {
  let isClosed = false;

  const send = (data: unknown) => {
    if (isClosed) return;
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Controller may have been closed by the client disconnecting
      isClosed = true;
    }
  };

  // Attach a close helper so callers can safely close the controller
  (send as SSESendWithClose).close = () => {
    if (isClosed) return;
    isClosed = true;
    try {
      controller.close();
    } catch {
      // Already closed -- ignore
    }
  };

  return send;
}

type SSESendWithClose = SSESend & { close: () => void };

function sendAgentStatus(
  send: SSESend,
  agent: AgentName,
  status: AgentStatus,
  message: string
) {
  send({ type: "agent-status", data: { agent, status, message } });
}

function sendAgentEvent(
  send: SSESend,
  agent: AgentName,
  action: ActionType,
  message: string,
  details?: Record<string, unknown>
) {
  send({
    type: "agent-event",
    data: { agent, action, message, timestamp: Date.now(), details },
  });
}

function sendCartSummary(send: SSESend, cart: CartSummary) {
  send({ type: "cart-summary", data: cart });
}

function sendStreamedText(send: SSESend, text: string) {
  send({ type: "streamed-text", data: { text } });
}

function sendDone(send: SSESend) {
  send({ type: "done" });
}

function sendError(send: SSESend, message: string) {
  send({ type: "error", data: { message } });
}

// ---------------------------------------------------------------------------
// Cents -> EUR formatting helper
// ---------------------------------------------------------------------------

function centsToEur(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // The client hook sends { userInput: string }
  const body = await req.json();
  const input: string = body.userInput ?? body.input ?? "";

  if (!input.trim()) {
    return new Response(JSON.stringify({ error: "No input provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check for required env vars
  if (
    !process.env.OPENAI_API_KEY &&
    !process.env.OPENROUTER_API_KEY &&
    !process.env.ANTHROPIC_API_KEY
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Missing API key. Set OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY in your environment.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = makeSend(controller, encoder);

      try {
        // ---------------------------------------------------------------
        // Step 1: Parse user intent (LLM call)
        // ---------------------------------------------------------------
        sendAgentStatus(send, "orchestrator", "running", "Parsing your request...");

        const intent = await parseIntent(input);

        sendAgentEvent(
          send,
          "orchestrator",
          "APPROVE",
          intent.meals.length > 0
            ? `Understood: ${intent.meals.length} meal(s) planned${intent.budget ? `, budget ${centsToEur(intent.budget)}` : ""}`
            : `Understood: weekly grocery shop${intent.budget ? `, budget ${centsToEur(intent.budget)}` : ""}`
        );

        // ---------------------------------------------------------------
        // Step 2: Prefetch all Picnic data (parallel API calls)
        // ---------------------------------------------------------------
        sendAgentStatus(send, "prefetch", "running", "Fetching Picnic data...");

        // Gather search queries from intent (meal dishes + special requests)
        const searchQueries = [
          ...intent.meals.map((m) => m.dish),
          ...intent.specialRequests,
        ].filter(Boolean);

        const data = await prefetchAll(
          searchQueries.length > 0 ? searchQueries : undefined
        );

        sendAgentEvent(
          send,
          "prefetch",
          "QUERY",
          `Loaded ${data.orders.length} orders, ${data.favorites.length} favorites, ${data.deliverySlots.length} delivery slots`
        );
        sendAgentStatus(send, "prefetch", "complete", "Data ready");

        // ---------------------------------------------------------------
        // Step 3: Run analysis on order history (pure TypeScript, instant)
        // ---------------------------------------------------------------
        const analysis = runFullAnalysis(data.orders);

        // ---------------------------------------------------------------
        // Step 4: Run 3 agents in parallel (LLM calls)
        // ---------------------------------------------------------------
        sendAgentStatus(send, "order-analyst", "running", "Analyzing order history...");
        sendAgentStatus(send, "meal-planner", "running", "Planning meals...");
        sendAgentStatus(send, "schedule-agent", "running", "Finding delivery slot...");

        // We need the order analyst result for the meal planner, but the task
        // spec says to run them in parallel. The meal planner's baseCart param
        // means we need order analyst first OR pass an empty base cart for
        // parallel execution. We run order analyst first, then meal planner +
        // schedule in parallel for correctness.
        const orderResult = await runOrderAnalyst(analysis, data);

        // Send order analyst events
        for (const item of orderResult.recommendedItems.slice(0, 5)) {
          sendAgentEvent(
            send,
            "order-analyst",
            "SUGGEST",
            `${item.name} -- ${item.reason}`
          );
        }
        if (orderResult.recommendedItems.length > 5) {
          sendAgentEvent(
            send,
            "order-analyst",
            "SUGGEST",
            `+${orderResult.recommendedItems.length - 5} more items from order history`
          );
        }
        sendAgentStatus(
          send,
          "order-analyst",
          "complete",
          `${orderResult.recommendedItems.length} items recommended`
        );

        // Now run meal planner + schedule agent in parallel
        const [mealResult, scheduleResult] = await Promise.all([
          runMealPlanner(intent, data, orderResult),
          runScheduleAgent(data, analysis),
        ]);

        // Send meal planner events
        for (const meal of mealResult.meals) {
          const ingredientNames = meal.ingredients
            .slice(0, 3)
            .map((i) => i.name)
            .join(", ");
          sendAgentEvent(
            send,
            "meal-planner",
            "SUGGEST",
            `${meal.day}: ${meal.mealName} -- adding ${ingredientNames}${meal.ingredients.length > 3 ? ` +${meal.ingredients.length - 3} more` : ""}`
          );
        }
        sendAgentStatus(
          send,
          "meal-planner",
          "complete",
          `${mealResult.meals.length} meals planned`
        );

        // Send schedule agent events
        if (scheduleResult.selectedSlot.slotId) {
          sendAgentEvent(
            send,
            "schedule-agent",
            "APPROVE",
            `Selected ${scheduleResult.selectedSlot.date} ${scheduleResult.selectedSlot.timeWindow} -- ${scheduleResult.selectedSlot.reasoning}`
          );
        }
        sendAgentStatus(send, "schedule-agent", "complete", "Slot selected");

        // ---------------------------------------------------------------
        // Step 5: Merge results, calculate total cost
        // ---------------------------------------------------------------
        const mergedItems = mergeCartItems(orderResult, mealResult, data);
        let totalCost = mergedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const budget = intent.budget ?? analysis.budget.avgWeeklySpend;
        let savings = 0;
        let substitutionCount = 0;
        let budgetOptimizerResult: BudgetOptimizerOutput | null = null;

        // ---------------------------------------------------------------
        // Step 6: Conditional budget optimizer
        // ---------------------------------------------------------------
        if (totalCost > budget) {
          const overage = totalCost - budget;

          sendAgentStatus(
            send,
            "budget-optimizer",
            "running",
            "Checking budget..."
          );
          sendAgentEvent(
            send,
            "budget-optimizer",
            "REJECT",
            `Cart total ${centsToEur(totalCost)} exceeds budget ${centsToEur(budget)} by ${centsToEur(overage)}`
          );

          try {
            // Dynamic import in case budget-optimizer is still being built
            const { runBudgetOptimizer } = await import(
              "@/lib/agents/budget-optimizer"
            );

            // Build alternatives map from search results + favorites
            const alternatives = buildAlternativesMap(mergedItems, data);

            const cartItemInputs = mergedItems.map((item) => ({
              itemId: item.itemId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              source: item.agentSource,
            }));

            budgetOptimizerResult = await runBudgetOptimizer(
              cartItemInputs,
              budget,
              alternatives
            );

            // Send substitution events
            for (const adj of budgetOptimizerResult.adjustments) {
              sendAgentEvent(
                send,
                "budget-optimizer",
                "SUBSTITUTE",
                `${adj.original.name} (${centsToEur(adj.original.price)}) -> ${adj.replacement.name} (${centsToEur(adj.replacement.price)}) -- saves ${centsToEur(adj.savings)}`
              );
            }

            // Apply adjustments to the merged items
            applyBudgetAdjustments(mergedItems, budgetOptimizerResult);

            totalCost = budgetOptimizerResult.optimizedTotal;
            savings = budgetOptimizerResult.originalTotal - budgetOptimizerResult.optimizedTotal;
            substitutionCount = budgetOptimizerResult.adjustments.length;

            sendAgentEvent(
              send,
              "budget-optimizer",
              "APPROVE",
              `Optimized total: ${centsToEur(totalCost)}${savings > 0 ? ` -- saved ${centsToEur(savings)}` : ""}`
            );
            sendAgentStatus(
              send,
              "budget-optimizer",
              "complete",
              `${substitutionCount} substitution(s), ${centsToEur(savings)} saved`
            );
          } catch (err) {
            console.error("Budget optimizer unavailable:", err);
            sendAgentEvent(
              send,
              "budget-optimizer",
              "APPROVE",
              `Budget optimizer unavailable -- proceeding with current cart at ${centsToEur(totalCost)}`
            );
            sendAgentStatus(
              send,
              "budget-optimizer",
              "complete",
              "Skipped (module unavailable)"
            );
          }
        }

        // ---------------------------------------------------------------
        // Step 7: Build cart summary and stream final text
        // ---------------------------------------------------------------
        const cartSummary: CartSummary = {
          items: mergedItems,
          totalCost,
          budget,
          isOverBudget: totalCost > budget,
          savings,
          substitutionCount,
          deliverySlot: scheduleResult.selectedSlot.slotId
            ? scheduleResult.selectedSlot
            : null,
        };

        sendCartSummary(send, cartSummary);

        // Stream orchestrator summary text
        sendAgentStatus(send, "orchestrator", "running", "Finalizing cart...");

        const orchestratorPrompt = buildOrchestratorPrompt({
          orderAnalyst: orderResult,
          mealPlanner: mealResult,
          budgetOptimizer: budgetOptimizerResult ?? {
            approved: true,
            originalTotal: totalCost,
            optimizedTotal: totalCost,
            adjustments: [],
          },
          scheduleAgent: scheduleResult,
        });

        const result = streamText({
          model: getModel("orchestrator"),
          prompt: orchestratorPrompt,
        });

        for await (const chunk of result.textStream) {
          sendStreamedText(send, chunk);
        }

        sendAgentEvent(
          send,
          "orchestrator",
          "APPROVE",
          `Cart finalized: ${mergedItems.length} items, ${centsToEur(totalCost)}${cartSummary.deliverySlot ? `, delivery ${cartSummary.deliverySlot.date} ${cartSummary.deliverySlot.timeWindow}` : ""}`
        );
        sendAgentStatus(send, "orchestrator", "complete", "Done");

        sendDone(send);
      } catch (err) {
        console.error("Orchestration pipeline error:", err);
        // Attempt to send the error event -- send() is safe if controller is already closed
        sendError(
          send,
          err instanceof Error ? err.message : "Unknown error occurred"
        );
      } finally {
        // Use the safe close helper to avoid "Controller is already closed" errors
        (send as SSESendWithClose).close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------------------
// Cart merging helpers
// ---------------------------------------------------------------------------

/**
 * Merge items from Order Analyst + Meal Planner into a unified CartItem[].
 * Deduplicates by itemId -- if both agents suggest the same item, the
 * quantities are summed and the reasoning from the first source is kept.
 */
function mergeCartItems(
  orderResult: OrderAnalystOutput,
  mealResult: MealPlannerOutput,
  data: { orders: Array<{ items: Array<{ selling_unit_id: string }> }> }
): CartItem[] {
  const itemMap = new Map<string, CartItem>();

  // Collect the set of item IDs from the most recent order for diffStatus
  const lastOrderItemIds = new Set<string>();
  if (data.orders.length > 0) {
    for (const item of data.orders[0].items) {
      lastOrderItemIds.add(item.selling_unit_id);
    }
  }

  // Add order analyst recommendations
  for (const rec of orderResult.recommendedItems) {
    const existing = itemMap.get(rec.itemId);
    if (existing) {
      existing.quantity += rec.suggestedQuantity;
    } else {
      itemMap.set(rec.itemId, {
        itemId: rec.itemId,
        name: rec.name,
        quantity: rec.suggestedQuantity,
        price: rec.pricePerUnit,
        reasonTag: rec.reasonTag,
        reasoning: rec.reason,
        agentSource: "order-analyst",
        diffStatus: lastOrderItemIds.has(rec.itemId) ? "unchanged" : "added",
      });
    }
  }

  // Add meal planner ingredients
  for (const meal of mealResult.meals) {
    for (const ing of meal.ingredients) {
      const existing = itemMap.get(ing.itemId);
      if (existing) {
        existing.quantity += ing.quantity;
      } else {
        itemMap.set(ing.itemId, {
          itemId: ing.itemId,
          name: ing.name,
          quantity: ing.quantity,
          price: ing.price,
          reasonTag: "recipe",
          reasoning: `Needed for ${meal.mealName} (${meal.day})`,
          agentSource: "meal-planner",
          diffStatus: lastOrderItemIds.has(ing.itemId) ? "unchanged" : "added",
        });
      }
    }
  }

  // Add additional ingredients from meal planner
  for (const rec of mealResult.additionalIngredients) {
    const existing = itemMap.get(rec.itemId);
    if (existing) {
      existing.quantity += rec.suggestedQuantity;
    } else {
      itemMap.set(rec.itemId, {
        itemId: rec.itemId,
        name: rec.name,
        quantity: rec.suggestedQuantity,
        price: rec.pricePerUnit,
        reasonTag: rec.reasonTag,
        reasoning: rec.reason,
        agentSource: "meal-planner",
        diffStatus: lastOrderItemIds.has(rec.itemId) ? "unchanged" : "added",
      });
    }
  }

  return Array.from(itemMap.values());
}

/**
 * Build a map of alternative products for each cart item.
 * Uses search results + favorites as potential alternatives.
 */
function buildAlternativesMap(
  cartItems: CartItem[],
  data: {
    searchResults: Record<string, Array<{ selling_unit_id: string; name: string; price: number }>>;
    favorites: Array<{ selling_unit_id: string; name: string; price: number }>;
  }
): Map<string, Array<{ itemId: string; name: string; price: number }>> {
  const alternatives = new Map<
    string,
    Array<{ itemId: string; name: string; price: number }>
  >();

  // Collect all available products from search results + favorites
  const allProducts: Array<{
    selling_unit_id: string;
    name: string;
    price: number;
  }> = [
    ...data.favorites,
    ...Object.values(data.searchResults).flat(),
  ];

  // For each cart item, find products with similar names that are cheaper
  for (const item of cartItems) {
    const itemNameLower = item.name.toLowerCase();
    const keywords = itemNameLower.split(/\s+/).filter((w) => w.length > 2);

    const matches = allProducts
      .filter((p) => {
        if (p.selling_unit_id === item.itemId) return false;
        const pNameLower = p.name.toLowerCase();
        // Match if at least one keyword overlaps
        return keywords.some((kw) => pNameLower.includes(kw));
      })
      .map((p) => ({
        itemId: p.selling_unit_id,
        name: p.name,
        price: p.price,
      }));

    if (matches.length > 0) {
      alternatives.set(item.itemId, matches);
    }
  }

  return alternatives;
}

/**
 * Apply budget optimizer adjustments to the merged cart items in-place.
 */
function applyBudgetAdjustments(
  items: CartItem[],
  result: BudgetOptimizerOutput
): void {
  for (const adj of result.adjustments) {
    const idx = items.findIndex((item) => item.itemId === adj.original.itemId);
    if (idx === -1) continue;

    items[idx] = {
      ...items[idx],
      itemId: adj.replacement.itemId,
      name: adj.replacement.name,
      price: adj.replacement.price,
      reasonTag: "substitution",
      reasoning: adj.reasoning,
      agentSource: "budget-optimizer",
      diffStatus: "substituted",
    };
  }
}
