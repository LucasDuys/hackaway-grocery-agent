import { parseIntent } from "@/lib/agents/intent-parser";
import { runOrderAnalyst } from "@/lib/agents/order-analyst";
import { runMealPlanner } from "@/lib/agents/meal-planner";
import { runScheduleAgent } from "@/lib/agents/schedule-agent";
import { prefetchAll } from "@/lib/picnic/prefetch";
import { runFullAnalysis } from "@/lib/analysis";
import {
  loadPreferences,
  savePreferences,
  derivePreferences,
  formatPreferencesForPrompt,
} from "@/lib/memory/preferences";
import { narrateEvent } from "@/lib/narrative";
import productCatalog from "@/data/product-catalog.json";
import type {
  CartItem,
  CartSummary,
  BudgetOptimizerOutput,
  OrderAnalystOutput,
  MealPlannerOutput,
  ScheduleAgentOutput,
  AgentName,
  AgentStatus,
  ActionType,
  PicnicProduct,
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
  message: string,
  durationMs?: number
) {
  send({ type: "agent-status", data: { agent, status, message, durationMs } });
}

function sendAgentEvent(
  send: SSESend,
  agent: AgentName,
  action: ActionType,
  message: string,
  details?: Record<string, unknown>
) {
  const narrativeMessage = narrateEvent(agent, action, message, details);
  send({
    type: "agent-event",
    data: {
      agent,
      action,
      message: narrativeMessage,
      rawMessage: message,
      timestamp: Date.now(),
      details,
    },
  });
}

function sendCartSummary(send: SSESend, cart: CartSummary) {
  send({ type: "cart-summary", data: cart });
}

function sendDone(send: SSESend) {
  send({ type: "done" });
}

function sendHandoff(
  send: SSESend,
  from: AgentName,
  to: AgentName,
  summary: string
) {
  send({ type: "agent-handoff", data: { from, to, summary } });
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
  // The client hook sends { userInput: string, dietaryRestrictions?: string[] }
  const body = await req.json();
  const input: string = body.userInput ?? body.input ?? "";
  const dietaryRestrictions: string[] | undefined = body.dietaryRestrictions;

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
        const timings: Record<string, number> = {};
        const startTotal = Date.now();

        // ---------------------------------------------------------------
        // Step 1: Parse user intent (LLM call)
        // ---------------------------------------------------------------
        sendAgentStatus(send, "orchestrator", "running", "Parsing your request...");

        const t0Intent = Date.now();
        const intent = await parseIntent(input);
        timings["orchestrator-parse"] = Date.now() - t0Intent;

        // Merge dietary restrictions from request body into parsed intent
        if (dietaryRestrictions && dietaryRestrictions.length > 0) {
          intent.dietaryRestrictions = dietaryRestrictions as import("@/types").DietaryRestriction[];
        }

        // Send dietary event if restrictions are active
        if (intent.dietaryRestrictions?.length) {
          sendAgentEvent(send, "orchestrator", "APPROVE",
            `Dietary restrictions active: ${intent.dietaryRestrictions.join(", ")}`
          );
        }

        // ---------------------------------------------------------------
        // Load user preferences from memory
        // ---------------------------------------------------------------
        const existingPrefs = loadPreferences();
        const preferencesContext = formatPreferencesForPrompt(existingPrefs);

        // ---------------------------------------------------------------
        // Auto mode detection: no meals, no guest events = replenishment only
        // ---------------------------------------------------------------
        const isAutoMode = intent.meals.length === 0 && intent.guestEvents.length === 0;

        sendAgentEvent(
          send,
          "orchestrator",
          "APPROVE",
          isAutoMode
            ? "Auto mode: building cart from your purchase patterns"
            : intent.meals.length > 0
              ? `Understood: ${intent.meals.length} meal(s) planned${intent.budget ? `, budget ${centsToEur(intent.budget)}` : ""}`
              : `Understood: weekly grocery shop${intent.budget ? `, budget ${centsToEur(intent.budget)}` : ""}`
        );

        // Send mode event so the UI can display the mode badge
        send({ type: "mode", data: { mode: isAutoMode ? "auto" : "custom" } });

        // ---------------------------------------------------------------
        // Step 1b: Synthesize meals from guest events without a matching meal
        // (skipped in auto mode)
        // ---------------------------------------------------------------
        if (!isAutoMode) {
          for (const event of intent.guestEvents) {
            const hasMealForDay = intent.meals.some(
              (m) => m.day.toLowerCase() === event.day.toLowerCase()
            );
            if (!hasMealForDay) {
              intent.meals.push({
                day: event.day,
                dish: `dinner for ${event.guestCount} guests (${event.description})`,
              });
            }
          }
        }

        // ---------------------------------------------------------------
        // Step 2: Prefetch all Picnic data (parallel API calls)
        // ---------------------------------------------------------------
        sendAgentStatus(send, "prefetch", "running", "Fetching Picnic data...");

        // Gather search queries from intent (meal dishes + special requests + product searches)
        // For goal-based meals, add Dutch search terms that map to the goal
        const goalSearchTermMap: Record<string, string[]> = {
          "high protein": ["kipfilet", "ei", "tonijn", "yoghurt", "gehakt", "kaas"],
          "low carb": ["groente", "vlees", "vis", "ei", "noten"],
          "healthy": ["salade", "groente", "fruit", "vis"],
          "easy": ["kant-en-klaar", "maaltijd", "magnetron"],
          "quick": ["kant-en-klaar", "maaltijd", "magnetron"],
        };

        const goalSearchQueries: string[] = [];
        for (const meal of intent.meals) {
          if (meal.goalBased) {
            const dishLower = meal.dish.toLowerCase();
            let matched = false;
            for (const [goal, terms] of Object.entries(goalSearchTermMap)) {
              if (dishLower.includes(goal)) {
                goalSearchQueries.push(...terms);
                matched = true;
                break;
              }
            }
            if (!matched) {
              // Generic/unknown goal
              goalSearchQueries.push("maaltijd", "avondeten", "recept");
            }
          }
        }

        const searchQueries = [
          ...intent.meals.map((m) => m.dish),
          ...intent.specialRequests,
          ...(intent.productSearchQueries ?? []),
          ...goalSearchQueries,
        ].filter(Boolean);

        const t0Prefetch = Date.now();
        const data = await prefetchAll(
          searchQueries.length > 0 ? searchQueries : undefined
        );
        timings["prefetch"] = Date.now() - t0Prefetch;

        sendAgentEvent(
          send,
          "prefetch",
          "QUERY",
          `Loaded ${data.orders.length} orders, ${data.favorites.length} favorites, ${data.deliverySlots.length} delivery slots`
        );
        sendAgentStatus(send, "prefetch", "complete", "Data ready", timings["prefetch"]);

        // ---------------------------------------------------------------
        // Step 3: Run analysis on order history (pure TypeScript, instant)
        // ---------------------------------------------------------------
        const analysis = runFullAnalysis(data.orders);

        // Build catalog price map early (used throughout the pipeline)
        const catalogPriceMap = new Map<string, number>();
        for (const p of productCatalog as Array<{ selling_unit_id: string; price: number }>) {
          catalogPriceMap.set(p.selling_unit_id, p.price);
        }
        for (const order of data.orders) {
          for (const item of order.items) {
            if (!catalogPriceMap.has(item.selling_unit_id) && item.price > 0) {
              catalogPriceMap.set(item.selling_unit_id, item.price);
            }
          }
        }

        // ---------------------------------------------------------------
        // Step 4: Run agents (skip meal planner in auto mode)
        // ---------------------------------------------------------------
        sendAgentStatus(send, "order-analyst", "running", "Analyzing order history...");
        if (!isAutoMode) {
          sendAgentStatus(send, "meal-planner", "running", "Planning meals...");
        } else {
          sendAgentStatus(send, "meal-planner", "complete", "Skipped (auto mode)");
        }
        sendAgentStatus(send, "schedule-agent", "running", "Finding delivery slot...");

        // We need the order analyst result for the meal planner, but the task
        // spec says to run them in parallel. The meal planner's baseCart param
        // means we need order analyst first OR pass an empty base cart for
        // parallel execution. We run order analyst first, then meal planner +
        // schedule in parallel for correctness.
        const t0OrderAnalyst = Date.now();
        const orderResult = await runOrderAnalyst(analysis, data, intent.budget, preferencesContext, intent.dietaryRestrictions);
        timings["order-analyst"] = Date.now() - t0OrderAnalyst;

        // Send order analyst events
        for (const item of orderResult.recommendedItems.slice(0, 5)) {
          sendAgentEvent(
            send,
            "order-analyst",
            "SUGGEST",
            `${item.name} -- ${item.reason}`,
            {
              itemName: item.name,
              reason: item.reason,
              quantity: item.suggestedQuantity,
              totalOrders: data.orders.length,
            }
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
          `${orderResult.recommendedItems.length} items recommended`,
          timings["order-analyst"]
        );

        // Handoff: Order Analyst -> Orchestrator
        // Recalculate total from catalog prices (LLM hallucinates totals)
        const orderAnalystRealTotal = orderResult.recommendedItems.reduce((sum, item) => {
          const realPrice = catalogPriceMap.get(item.itemId) ?? item.pricePerUnit;
          return sum + realPrice * item.suggestedQuantity;
        }, 0);
        sendHandoff(
          send,
          "order-analyst",
          "orchestrator",
          `${orderResult.recommendedItems.length} items, ${centsToEur(orderAnalystRealTotal)} estimated`
        );

        // In auto mode, skip meal planner entirely; run schedule agent alone.
        // In custom mode, run meal planner + schedule agent in parallel.
        let mealResult: MealPlannerOutput;
        let scheduleResult: ScheduleAgentOutput;

        const t0Parallel = Date.now();
        if (isAutoMode) {
          mealResult = { meals: [], additionalIngredients: [] };
          timings["meal-planner"] = 0;
          scheduleResult = await runScheduleAgent(data, analysis);
          timings["schedule-agent"] = Date.now() - t0Parallel;
        } else {
          const t0Meal = Date.now();
          const t0Schedule = Date.now();
          const mealPromise = runMealPlanner(intent, data, orderResult, preferencesContext).then((r) => {
            timings["meal-planner"] = Date.now() - t0Meal;
            return r;
          });
          const schedulePromise = runScheduleAgent(data, analysis).then((r) => {
            timings["schedule-agent"] = Date.now() - t0Schedule;
            return r;
          });
          [mealResult, scheduleResult] = await Promise.all([
            mealPromise,
            schedulePromise,
          ]);
        }

        // Correct meal costs from catalog (LLM guesses round numbers)
        for (const meal of mealResult.meals) {
          let realCost = 0;
          for (const ing of meal.ingredients) {
            const catalogPrice = catalogPriceMap.get(ing.itemId);
            if (catalogPrice && catalogPrice > 0) {
              ing.price = catalogPrice;
            } else if (ing.price <= 0) {
              // Fuzzy name match
              const nameWords = ing.name.toLowerCase().split(/\s+/);
              const match = (productCatalog as Array<{ selling_unit_id: string; name: string; price: number }>).find(p => {
                const pName = p.name.toLowerCase();
                return nameWords.some(w => w.length > 3 && pName.includes(w));
              });
              if (match) {
                ing.price = match.price;
                ing.itemId = match.selling_unit_id;
              } else {
                ing.price = 299;
              }
            }
            realCost += ing.price * ing.quantity;
          }
          meal.estimatedCost = realCost;
        }

        // Filter out SKIP items (zero-hallucination guardrail)
        for (const meal of mealResult.meals) {
          meal.ingredients = meal.ingredients.filter(
            (ing) => ing.itemId !== "SKIP" && ing.itemId !== "UNKNOWN"
          );
          meal.estimatedCost = meal.ingredients.reduce(
            (sum, ing) => sum + ing.price * ing.quantity,
            0
          );
        }

        // Handle productSearchQueries as direct cart additions
        // These bypass the meal planner -- they're direct product additions (e.g., snacks)
        const snackSuggestions: CartItem[] = [];
        if (intent.productSearchQueries && intent.productSearchQueries.length > 0) {
          for (const query of intent.productSearchQueries) {
            // First check prefetched search results
            const prefetchedResults = data.searchResults[query];
            if (prefetchedResults && prefetchedResults.length > 0) {
              const topResults = prefetchedResults.slice(0, 3);
              for (const product of topResults) {
                snackSuggestions.push({
                  itemId: product.selling_unit_id,
                  name: product.name,
                  quantity: 1,
                  price: product.price,
                  imageUrl: product.image_url,
                  reasonTag: "suggestion",
                  reasoning: `Suggested for "${query}"`,
                  agentSource: "orchestrator",
                  diffStatus: "added",
                });
              }
            }
          }

          if (snackSuggestions.length > 0) {
            sendAgentEvent(
              send,
              "orchestrator",
              "SUGGEST",
              `Added ${snackSuggestions.length} product suggestion(s) for: ${intent.productSearchQueries.join(", ")}`,
              { queries: intent.productSearchQueries, count: snackSuggestions.length }
            );
          }
        }

        // Build a map from recipe name to recipe image for meal cards
        const recipeImageMap = new Map<string, string>();
        for (const recipe of data.recipes) {
          if (recipe.imageUrl) {
            recipeImageMap.set(recipe.name.toLowerCase(), recipe.imageUrl);
          }
        }

        // Send meal planner events
        for (const meal of mealResult.meals) {
          const ingredientNames = meal.ingredients
            .slice(0, 3)
            .map((i) => i.name)
            .join(", ");
          const guestEvent = intent.guestEvents.find(
            (e) => e.day.toLowerCase() === meal.day.toLowerCase()
          );
          sendAgentEvent(
            send,
            "meal-planner",
            "SUGGEST",
            `${meal.day}: ${meal.mealName} -- adding ${ingredientNames}${meal.ingredients.length > 3 ? ` +${meal.ingredients.length - 3} more` : ""}`,
            {
              day: meal.day,
              mealName: meal.mealName,
              ingredientCount: meal.ingredients.length,
              isGuestEvent: !!guestEvent,
              guestCount: guestEvent?.guestCount,
            }
          );
        }

        // Send structured meal plan data (with images and real costs)
        send({
          type: "meal-plan",
          data: mealResult.meals.map((meal) => {
            // Try exact recipe name match, then fuzzy match
            let imageUrl = recipeImageMap.get(meal.mealName.toLowerCase());
            if (!imageUrl) {
              const mealWords = meal.mealName.toLowerCase().split(/\s+/);
              for (const [recipeName, img] of recipeImageMap.entries()) {
                if (mealWords.some((w) => w.length > 3 && recipeName.includes(w))) {
                  imageUrl = img;
                  break;
                }
              }
            }
            return {
              day: meal.day,
              mealName: meal.mealName,
              ingredientCount: meal.ingredients.length,
              estimatedCost: meal.estimatedCost,
              imageUrl,
              ingredients: meal.ingredients.map((ing) => ({
                name: ing.name,
                quantity: ing.quantity,
                price: ing.price,
              })),
            };
          }),
        });

        sendAgentStatus(
          send,
          "meal-planner",
          "complete",
          `${mealResult.meals.length} meals planned`,
          timings["meal-planner"]
        );

        // Handoff: Meal Planner -> Budget Optimizer
        if (mealResult.meals.length > 0) {
          const totalMealIngredients = mealResult.meals.reduce(
            (sum, m) => sum + m.ingredients.length,
            0
          );
          const totalMealCost = mealResult.meals.reduce(
            (sum, m) => sum + m.estimatedCost,
            0
          );
          sendHandoff(
            send,
            "meal-planner",
            "budget-optimizer",
            `${mealResult.meals.length} meals, ${totalMealIngredients} ingredients, ${centsToEur(totalMealCost)}`
          );
        }

        // Send schedule agent events
        if (scheduleResult.selectedSlot.slotId) {
          sendAgentEvent(
            send,
            "schedule-agent",
            "APPROVE",
            `Selected ${scheduleResult.selectedSlot.date} ${scheduleResult.selectedSlot.timeWindow} -- ${scheduleResult.selectedSlot.reasoning}`,
            {
              date: scheduleResult.selectedSlot.date,
              timeWindow: scheduleResult.selectedSlot.timeWindow,
              reasoning: scheduleResult.selectedSlot.reasoning,
            }
          );
        }
        sendAgentStatus(send, "schedule-agent", "complete", "Slot selected", timings["schedule-agent"]);

        // Handoff: Schedule Agent -> Orchestrator
        if (scheduleResult.selectedSlot.slotId) {
          sendHandoff(
            send,
            "schedule-agent",
            "orchestrator",
            `Delivery: ${scheduleResult.selectedSlot.date} ${scheduleResult.selectedSlot.timeWindow}`
          );
        }

        // ---------------------------------------------------------------
        // Step 5: Merge results, correct prices from catalog, calculate total
        // ---------------------------------------------------------------
        const mergedItems = mergeCartItems(orderResult, mealResult, data);

        // Filter out SKIP/UNKNOWN items (zero-hallucination guardrail)
        for (let i = mergedItems.length - 1; i >= 0; i--) {
          if (mergedItems[i].itemId === "SKIP" || mergedItems[i].itemId === "UNKNOWN") {
            mergedItems.splice(i, 1);
          }
        }

        // Add snack/product search suggestions to the merged cart
        for (const snack of snackSuggestions) {
          const existing = mergedItems.find((m) => m.itemId === snack.itemId);
          if (existing) {
            existing.quantity += snack.quantity;
          } else {
            mergedItems.push(snack);
          }
        }

        // Correct prices and set images: use real catalog data instead of LLM-hallucinated values
        for (const item of mergedItems) {
          const catalogProduct = (productCatalog as Array<{ selling_unit_id: string; price: number; image_url?: string }>).find(
            (p) => p.selling_unit_id === item.itemId
          );
          if (catalogProduct) {
            if (catalogProduct.price > 0) {
              item.price = catalogProduct.price;
            }
            if (catalogProduct.image_url) {
              item.imageUrl = catalogProduct.image_url;
            }
          } else if (item.price <= 0) {
            // If no catalog price and LLM returned 0, estimate from similar items
            item.price = 299; // EUR 2.99 default for unknown items
          }

          // Fall back to order history for images
          if (!item.imageUrl) {
            for (const order of data.orders) {
              const historyItem = order.items.find(
                (i) => i.selling_unit_id === item.itemId
              );
              if (historyItem?.image_url) {
                item.imageUrl = historyItem.image_url;
                break;
              }
            }
          }
        }

        // For items stuck at the EUR 2.99 fallback, try fuzzy name matching
        // against the product catalog to find real prices
        for (const item of mergedItems) {
          if (item.price === 299) {
            const nameWords = item.name.toLowerCase().split(/\s+/);
            const match = (productCatalog as Array<{ selling_unit_id: string; name: string; price: number; image_url?: string }>).find(p => {
              const pName = p.name.toLowerCase();
              return nameWords.some((w: string) => w.length > 3 && pName.includes(w));
            });
            if (match) {
              item.price = match.price;
              item.itemId = match.selling_unit_id;
              if (match.image_url) {
                item.imageUrl = match.image_url;
              }
            }
          }
        }

        // For items still at the EUR 2.99 fallback, search the Picnic API
        // directly to get real prices instead of showing made-up amounts
        const { PicnicClient } = await import("@/lib/picnic/client");
        const liveClient = new PicnicClient();

        const fallbackItems = mergedItems.filter(item => item.price === 299 || item.price <= 0);
        if (fallbackItems.length > 0) {
          await liveClient.authenticate();
          for (const item of fallbackItems) {
            try {
              const searchResult = await liveClient.get<{ results?: Array<{ id: string; price: number; image_url?: string }> }>("hackathon-search-products", {
                query: item.name.split(/\s+/).slice(0, 2).join(" "),
                limit: "3",
              });
              if (searchResult?.results?.length && searchResult.results.length > 0) {
                const match = searchResult.results[0];
                item.price = match.price;
                item.itemId = match.id;
                if (match.image_url) {
                  item.imageUrl = match.image_url;
                }
              }
            } catch {
              // Keep fallback price if search fails
            }
          }
        }

        let totalCost = mergedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const budget = isAutoMode
          ? analysis.budget.avgWeeklySpend
          : (intent.budget ?? analysis.budget.avgWeeklySpend);
        let savings = 0;
        let substitutionCount = 0;
        let budgetOptimizerResult: BudgetOptimizerOutput | null = null;

        // ---------------------------------------------------------------
        // Step 6: Conditional budget optimizer
        // ---------------------------------------------------------------
        const t0Budget = Date.now();
        if (totalCost <= budget) {
          // Under budget -- skip optimizer
          timings["budget-optimizer"] = Date.now() - t0Budget;
          sendAgentEvent(
            send,
            "budget-optimizer",
            "APPROVE",
            `Cart ${centsToEur(totalCost)} is within budget ${centsToEur(budget)} -- no optimization needed`,
            {
              optimizedTotal: totalCost,
              budget,
              swapCount: 0,
              removalCount: 0,
              totalSavings: 0,
            }
          );
          sendAgentStatus(send, "budget-optimizer", "complete", "Within budget", timings["budget-optimizer"]);

          // Handoff: Budget Optimizer -> Orchestrator (no changes needed)
          sendHandoff(
            send,
            "budget-optimizer",
            "orchestrator",
            `No changes, ${centsToEur(totalCost)} within budget`
          );
        } else if (totalCost > budget) {
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
            `Cart total ${centsToEur(totalCost)} exceeds budget ${centsToEur(budget)} by ${centsToEur(overage)}`,
            { totalCost, budget }
          );

          try {
            // Dynamic import in case budget-optimizer is still being built
            const { runBudgetOptimizer } = await import(
              "@/lib/agents/budget-optimizer"
            );

            // Build alternatives map from search results + favorites + product catalog
            const alternatives = buildAlternativesMap(mergedItems, data);

            // Build item priority map from analysis classifications
            const itemPriorities = new Map<
              string,
              "staple" | "regular" | "occasional" | "one-time"
            >();
            for (const classification of analysis.classifications) {
              itemPriorities.set(classification.itemId, classification.category);
            }

            const cartItemInputs = mergedItems.map((item) => ({
              itemId: item.itemId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              source: item.agentSource,
              reasonTag: item.reasonTag,
            }));

            budgetOptimizerResult = await runBudgetOptimizer(
              cartItemInputs,
              budget,
              alternatives,
              itemPriorities
            );

            // Cap adjustments to MAX 3 swaps regardless of what the LLM returned
            if (budgetOptimizerResult.adjustments.length > 3) {
              budgetOptimizerResult.adjustments = budgetOptimizerResult.adjustments.slice(0, 3);
            }

            // Send events for each adjustment
            for (const adj of budgetOptimizerResult.adjustments) {
              const isRemoval = adj.replacement.price === 0;
              if (isRemoval) {
                // Find the item's priority for narrative context
                const priority = itemPriorities.get(adj.original.itemId) ?? "occasional";
                sendAgentEvent(
                  send,
                  "budget-optimizer",
                  "REJECT",
                  `Removed ${adj.original.name} -- ${centsToEur(adj.savings)} saved`,
                  {
                    itemName: adj.original.name,
                    itemPrice: adj.original.price,
                    priority,
                  }
                );
              } else {
                sendAgentEvent(
                  send,
                  "budget-optimizer",
                  "SUBSTITUTE",
                  `${adj.original.name} (${centsToEur(adj.original.price)}) -> ${adj.replacement.name} (${centsToEur(adj.replacement.price)}) -- saves ${centsToEur(adj.savings)}`,
                  {
                    originalName: adj.original.name,
                    originalPrice: adj.original.price,
                    replacementName: adj.replacement.name,
                    replacementPrice: adj.replacement.price,
                    savings: adj.savings,
                  }
                );
              }
            }

            // Apply adjustments to the merged items
            applyBudgetAdjustments(mergedItems, budgetOptimizerResult);

            // Recalculate total from actual items instead of trusting LLM
            totalCost = mergedItems.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
            savings = budgetOptimizerResult.originalTotal - totalCost;
            substitutionCount = budgetOptimizerResult.adjustments.length;

            // Count swaps vs removals for narrative
            const swapCount = budgetOptimizerResult.adjustments.filter(
              (a) => a.replacement.price > 0
            ).length;
            const removalCount = budgetOptimizerResult.adjustments.filter(
              (a) => a.replacement.price === 0
            ).length;
            sendAgentEvent(
              send,
              "budget-optimizer",
              "APPROVE",
              `Optimized total: ${centsToEur(totalCost)}${savings > 0 ? ` -- saved ${centsToEur(savings)}` : ""}`,
              {
                optimizedTotal: totalCost,
                budget,
                swapCount,
                removalCount,
                totalSavings: savings,
              }
            );
            timings["budget-optimizer"] = Date.now() - t0Budget;
            sendAgentStatus(
              send,
              "budget-optimizer",
              "complete",
              `${substitutionCount} adjustment(s), ${centsToEur(savings)} saved`,
              timings["budget-optimizer"]
            );

            // Handoff: Budget Optimizer -> Orchestrator
            sendHandoff(
              send,
              "budget-optimizer",
              "orchestrator",
              `${swapCount} swaps, ${removalCount} removals, ${centsToEur(savings)} saved`
            );
          } catch (err) {
            console.error("Budget optimizer unavailable:", err);
            sendAgentEvent(
              send,
              "budget-optimizer",
              "APPROVE",
              `Budget optimizer unavailable -- proceeding with current cart at ${centsToEur(totalCost)}`
            );
            timings["budget-optimizer"] = Date.now() - t0Budget;
            sendAgentStatus(
              send,
              "budget-optimizer",
              "complete",
              "Skipped (module unavailable)",
              timings["budget-optimizer"]
            );
          }
        }

        // ---------------------------------------------------------------
        // Step 7: ABSOLUTE FINAL BUDGET CHECK -- recalculate from actual
        // items and remove until under budget if needed
        // ---------------------------------------------------------------
        totalCost = mergedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        while (totalCost > budget && mergedItems.length > 0) {
          // Remove the last non-staple item
          const removableIdx = mergedItems.findLastIndex(
            (i) => i.reasonTag !== "repeat"
          );
          if (removableIdx === -1) break;
          const removed = mergedItems.splice(removableIdx, 1)[0];
          totalCost -= removed.price * removed.quantity;
        }

        // ---------------------------------------------------------------
        // Step 8: Build cart summary and send finalization event
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
          mode: isAutoMode ? "auto" : "custom",
        };

        sendCartSummary(send, cartSummary);

        // Just send the delivery info, no text summary needed
        sendAgentEvent(
          send,
          "orchestrator",
          "APPROVE",
          `Cart finalized: ${mergedItems.length} items, ${centsToEur(totalCost)}` +
            (cartSummary.deliverySlot
              ? `, delivery ${cartSummary.deliverySlot.date} ${cartSummary.deliverySlot.timeWindow}`
              : ""),
          {
            itemCount: mergedItems.length,
            totalCost,
            deliveryDate: cartSummary.deliverySlot?.date ?? null,
            deliveryWindow: cartSummary.deliverySlot?.timeWindow ?? null,
          }
        );
        timings["orchestrator"] = Date.now() - startTotal;
        sendAgentStatus(send, "orchestrator", "complete", "Done", timings["orchestrator"]);

        // ---------------------------------------------------------------
        // Step 9: Derive and save preferences, send learning insights
        // ---------------------------------------------------------------
        const updatedPrefs = derivePreferences(
          cartSummary,
          intent,
          budgetOptimizerResult,
          existingPrefs
        );
        savePreferences(updatedPrefs);

        // Build human-readable insights from what was learned this run
        const insights: string[] = [];

        if (updatedPrefs.deliveryPreferences.preferredDay) {
          const timeNote = updatedPrefs.deliveryPreferences.preferredTimeWindow
            ? ` ${updatedPrefs.deliveryPreferences.preferredTimeWindow}`
            : "";
          insights.push(
            `Learned: you prefer ${updatedPrefs.deliveryPreferences.preferredDay}${timeNote} deliveries`
          );
        }

        if (updatedPrefs.budgetPatterns.averageBudget > 0) {
          insights.push(
            `Learned: typical budget is EUR ${(updatedPrefs.budgetPatterns.averageBudget / 100).toFixed(0)}`
          );
        }

        for (const bp of updatedPrefs.brandPreferences.slice(-3)) {
          insights.push(
            `Learned: you prefer ${bp.preferred} over ${bp.rejected}`
          );
        }

        if (updatedPrefs.alwaysInclude.length > 0) {
          insights.push(
            `Learned: always include ${updatedPrefs.alwaysInclude.length} staple item(s)`
          );
        }

        if (updatedPrefs.neverSuggest.length > 0) {
          insights.push(
            `Learned: ${updatedPrefs.neverSuggest.length} item(s) on your never-suggest list`
          );
        }

        send({
          type: "learning-insights",
          data: { insights, runCount: updatedPrefs.runCount },
        });

        send({
          type: "timing-summary",
          data: {
            total: Date.now() - startTotal,
            steps: timings,
          },
        });

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

  // Deduplicate by name: LLM might use different IDs for the same product
  // Normalize aggressively: lowercase, trim, collapse whitespace, remove diacritics
  const nameMap = new Map<string, CartItem>();
  for (const item of itemMap.values()) {
    const normalized = item.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
    const existing = nameMap.get(normalized);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      nameMap.set(normalized, item);
    }
  }

  return Array.from(nameMap.values());
}

/**
 * Build a map of alternative products for each cart item.
 * Uses the product catalog, search results, and favorites as sources.
 * Matches by extracting the primary keyword from the product name and
 * finding other products of the same general type at a lower price.
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

  // Collect all available products from catalog + search results + favorites
  const allProducts: Array<{
    selling_unit_id: string;
    name: string;
    price: number;
  }> = [
    ...(productCatalog as PicnicProduct[]),
    ...data.favorites,
    ...Object.values(data.searchResults).flat(),
  ];

  // Deduplicate by selling_unit_id
  const productMap = new Map<string, { selling_unit_id: string; name: string; price: number }>();
  for (const p of allProducts) {
    if (!productMap.has(p.selling_unit_id)) {
      productMap.set(p.selling_unit_id, p);
    }
  }
  const uniqueProducts = Array.from(productMap.values());

  // Common Dutch/English stop words to skip when extracting keywords
  const stopWords = new Set([
    "de", "het", "een", "van", "en", "in", "op", "met", "voor",
    "the", "a", "an", "of", "and", "in", "on", "with", "for",
    "ah", "jumbo", "plus", "biologisch", "organic", "bio",
    "mijn", "vers", "verse",
  ]);

  /**
   * Extract meaningful keywords from a product name for category matching.
   * Returns the first 1-2 meaningful words that identify the product type.
   */
  function extractKeywords(name: string): string[] {
    const words = name
      .toLowerCase()
      .replace(/[0-9]+[gml]*/g, "") // Remove quantities like "500g", "1l"
      .split(/[\s\-\/]+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    // Return the first two meaningful words as category identifiers
    return words.slice(0, 2);
  }

  for (const item of cartItems) {
    const itemKeywords = extractKeywords(item.name);
    if (itemKeywords.length === 0) continue;

    const matches = uniqueProducts
      .filter((p) => {
        if (p.selling_unit_id === item.itemId) return false;
        if (p.price >= item.price) return false; // only cheaper alternatives
        const pNameLower = p.name.toLowerCase();
        // Match if the primary keyword (first meaningful word) appears in the product name
        return itemKeywords.some((kw) => pNameLower.includes(kw));
      })
      .map((p) => ({
        itemId: p.selling_unit_id,
        name: p.name,
        price: p.price,
      }))
      // Sort by price ascending so cheapest alternatives come first
      .sort((a, b) => a.price - b.price)
      // Limit to top 5 alternatives per item to keep the prompt manageable
      .slice(0, 5);

    if (matches.length > 0) {
      alternatives.set(item.itemId, matches);
    }
  }

  return alternatives;
}

/**
 * Apply budget optimizer adjustments to the merged cart items in-place.
 * Handles both substitutions (replacement with different item) and removals
 * (replacement price === 0).
 */
function applyBudgetAdjustments(
  items: CartItem[],
  result: BudgetOptimizerOutput
): void {
  // Process removals after substitutions to avoid index shifting issues
  const toRemove: string[] = [];

  for (const adj of result.adjustments) {
    const idx = items.findIndex((item) => item.itemId === adj.original.itemId);
    if (idx === -1) continue;

    if (adj.replacement.price === 0) {
      // Mark for removal
      toRemove.push(adj.original.itemId);
      items[idx] = {
        ...items[idx],
        reasoning: adj.reasoning,
        agentSource: "budget-optimizer",
        diffStatus: "removed",
      };
    } else {
      // Substitution
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

  // Remove items marked for removal (iterate in reverse to preserve indices)
  for (let i = items.length - 1; i >= 0; i--) {
    if (toRemove.includes(items[i].itemId) && items[i].diffStatus === "removed") {
      items.splice(i, 1);
    }
  }
}
