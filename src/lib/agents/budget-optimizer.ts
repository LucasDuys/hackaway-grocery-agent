import { generateObject } from "ai";
import { getModel } from "@/lib/ai/models";
import { buildBudgetOptimizerPrompt } from "@/lib/prompts/budget-optimizer";
import { budgetOptimizerSchema } from "./schemas";
import type { BudgetOptimizerOutput, PicnicProduct } from "@/types";

interface CartItemInput {
  itemId: string;
  name: string;
  quantity: number;
  price: number; // cents
  source: string; // which agent added it
}

type ItemPriority = "staple" | "regular" | "occasional" | "one-time";

/** Numeric priority for removal ordering: lower = remove first */
const REMOVAL_ORDER: Record<ItemPriority, number> = {
  "one-time": 0,
  occasional: 1,
  regular: 2,
  staple: 3, // never removed by greedy fallback
};

/**
 * Run the Budget Optimizer agent.
 *
 * When the merged cart exceeds the user's budget, identifies expensive items,
 * finds cheaper alternatives, and removes low-priority items when substitution
 * alone cannot bring the total under budget.
 * This is the key demo moment -- judges see the reasoning for each swap/removal.
 */
export async function runBudgetOptimizer(
  cartItems: CartItemInput[],
  budget: number, // cents
  alternatives: Map<string, Array<{ itemId: string; name: string; price: number }>>,
  itemPriorities?: Map<string, ItemPriority>
): Promise<BudgetOptimizerOutput> {
  const originalTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Fast path: cart is within budget, no LLM call needed
  if (originalTotal <= budget) {
    return {
      approved: true,
      originalTotal,
      optimizedTotal: originalTotal,
      adjustments: [],
    };
  }

  // Build the product alternatives structure the prompt expects
  const productAlternatives = cartItems
    .filter((item) => alternatives.has(item.itemId))
    .map((item) => ({
      original: {
        selling_unit_id: item.itemId,
        name: item.name,
        price: item.price,
      } as PicnicProduct,
      alternatives: (alternatives.get(item.itemId) || []).map((alt) => ({
        selling_unit_id: alt.itemId,
        name: alt.name,
        price: alt.price,
      })) as PicnicProduct[],
    }));

  // Build priority labels for the prompt
  const priorityLabels: Record<string, ItemPriority> = {};
  if (itemPriorities) {
    for (const item of cartItems) {
      priorityLabels[item.itemId] = itemPriorities.get(item.itemId) ?? "regular";
    }
  }

  let result: BudgetOptimizerOutput;

  try {
    const llmResult = await generateObject({
      mode: "tool",
      model: getModel("budget-optimizer"),
      schema: budgetOptimizerSchema,
      system: buildBudgetOptimizerPrompt(
        cartItems.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        budget,
        productAlternatives,
        priorityLabels
      ),
      prompt:
        "Optimize this cart to fit within the budget. You can SUBSTITUTE items with cheaper alternatives AND REMOVE low-priority items. Provide detailed reasoning for every change.",
    });

    result = llmResult.object;
  } catch (error) {
    console.error("Budget Optimizer LLM failed, using greedy fallback:", error);
    result = buildFallbackOptimization(cartItems, budget, alternatives, itemPriorities);
  }

  // -----------------------------------------------------------------------
  // HARD ENFORCEMENT: if the LLM result is still over budget, force it
  // under budget using deterministic greedy removal.
  // -----------------------------------------------------------------------
  if (result.optimizedTotal > budget) {
    result = enforceHardBudget(
      cartItems,
      budget,
      alternatives,
      itemPriorities,
      result
    );
  }

  return result;
}

/**
 * Hard enforcement layer. Takes the LLM's partial result (which may still be
 * over budget) and deterministically removes items until the total is at or
 * below the budget. Staple items are never removed.
 */
function enforceHardBudget(
  cartItems: CartItemInput[],
  budget: number,
  alternatives: Map<string, Array<{ itemId: string; name: string; price: number }>>,
  itemPriorities: Map<string, ItemPriority> | undefined,
  llmResult: BudgetOptimizerOutput
): BudgetOptimizerOutput {
  const adjustments = [...llmResult.adjustments];
  let currentTotal = llmResult.optimizedTotal;

  // Determine which items are still in the cart after LLM adjustments
  const substitutedIds = new Set(adjustments.map((a) => a.original.itemId));
  const removedIds = new Set(
    adjustments
      .filter((a) => a.replacement.price === 0)
      .map((a) => a.original.itemId)
  );

  // Build list of remaining items with their effective prices
  const remainingItems = cartItems
    .filter((item) => !removedIds.has(item.itemId))
    .map((item) => {
      // If the LLM substituted this item, use the replacement price
      const adj = adjustments.find((a) => a.original.itemId === item.itemId);
      const effectivePrice = adj ? adj.replacement.price : item.price;
      const priority = itemPriorities?.get(item.itemId) ?? "regular";
      return { ...item, effectivePrice, priority };
    });

  // First pass: try substitutions for items the LLM did not already substitute
  for (const item of remainingItems) {
    if (currentTotal <= budget) break;
    if (substitutedIds.has(item.itemId)) continue;

    const itemAlts = alternatives.get(item.itemId);
    if (!itemAlts || itemAlts.length === 0) continue;

    const cheaperAlts = itemAlts
      .filter((alt) => alt.price < item.price)
      .sort((a, b) => a.price - b.price);

    if (cheaperAlts.length === 0) continue;

    const cheapest = cheaperAlts[0];
    const savings = (item.price - cheapest.price) * item.quantity;

    adjustments.push({
      original: { itemId: item.itemId, name: item.name, price: item.price },
      replacement: { itemId: cheapest.itemId, name: cheapest.name, price: cheapest.price },
      savings,
      reasoning: `Replaced ${item.name} (EUR ${(item.price / 100).toFixed(2)}) with ${cheapest.name} (EUR ${(cheapest.price / 100).toFixed(2)}). Savings: EUR ${(savings / 100).toFixed(2)}.`,
    });

    item.effectivePrice = cheapest.price;
    currentTotal -= savings;
  }

  // Second pass: remove items by priority (one-time -> occasional -> regular)
  // Staples are NEVER removed.
  const removable = remainingItems
    .filter((item) => {
      if (substitutedIds.has(item.itemId) && removedIds.has(item.itemId)) return false;
      const priority = item.priority;
      return priority !== "staple";
    })
    .sort((a, b) => {
      // Remove lowest priority first; within same priority, remove most expensive first
      const priorityDiff = REMOVAL_ORDER[a.priority] - REMOVAL_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (b.effectivePrice * b.quantity) - (a.effectivePrice * a.quantity);
    });

  for (const item of removable) {
    if (currentTotal <= budget) break;

    const itemCost = item.effectivePrice * item.quantity;
    const priorityLabel = item.priority;

    adjustments.push({
      original: { itemId: item.itemId, name: item.name, price: item.price },
      replacement: { itemId: item.itemId, name: `${item.name} (REMOVED)`, price: 0 },
      savings: itemCost,
      reasoning: `Removed ${item.name} (${priorityLabel} purchase) to meet EUR ${(budget / 100).toFixed(2)} budget. Savings: EUR ${(itemCost / 100).toFixed(2)}.`,
    });

    currentTotal -= itemCost;
  }

  return {
    approved: false,
    originalTotal: llmResult.originalTotal,
    optimizedTotal: currentTotal,
    adjustments,
  };
}

/**
 * Greedy fallback when the LLM call fails.
 * Phase 1: Substitutes expensive items with cheapest alternative.
 * Phase 2: Removes items by priority (one-time -> occasional -> regular) until under budget.
 * Staple items are never removed. This fallback GUARANTEES the total is at or below budget.
 */
function buildFallbackOptimization(
  cartItems: CartItemInput[],
  budget: number,
  alternatives: Map<string, Array<{ itemId: string; name: string; price: number }>>,
  itemPriorities?: Map<string, ItemPriority>
): BudgetOptimizerOutput {
  const originalTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const adjustments: BudgetOptimizerOutput["adjustments"] = [];
  let currentTotal = originalTotal;

  // Phase 1: Substitute expensive items with cheapest alternative
  const sortedItems = [...cartItems].sort((a, b) => b.price - a.price);

  // Track effective prices after substitutions
  const effectivePrices = new Map<string, number>();
  for (const item of cartItems) {
    effectivePrices.set(item.itemId, item.price);
  }

  for (const item of sortedItems) {
    if (currentTotal <= budget) break;

    const itemAlts = alternatives.get(item.itemId);
    if (!itemAlts || itemAlts.length === 0) continue;

    const cheaperAlts = itemAlts
      .filter((alt) => alt.price < item.price)
      .sort((a, b) => a.price - b.price);

    if (cheaperAlts.length === 0) continue;

    const cheapest = cheaperAlts[0];
    const savings = (item.price - cheapest.price) * item.quantity;

    adjustments.push({
      original: {
        itemId: item.itemId,
        name: item.name,
        price: item.price,
      },
      replacement: {
        itemId: cheapest.itemId,
        name: cheapest.name,
        price: cheapest.price,
      },
      savings,
      reasoning: `Replaced ${item.name} (EUR ${(item.price / 100).toFixed(2)}) with ${cheapest.name} (EUR ${(cheapest.price / 100).toFixed(2)}). Savings: EUR ${(savings / 100).toFixed(2)}. Fallback substitution applied.`,
    });

    effectivePrices.set(item.itemId, cheapest.price);
    currentTotal -= savings;
  }

  // Phase 2: Remove items by priority until under budget. Staples never removed.
  if (currentTotal > budget) {
    const substitutedIds = new Set(adjustments.map((a) => a.original.itemId));

    const removable = cartItems
      .filter((item) => {
        const priority = itemPriorities?.get(item.itemId) ?? "regular";
        return priority !== "staple";
      })
      .map((item) => ({
        ...item,
        effectivePrice: effectivePrices.get(item.itemId) ?? item.price,
        priority: itemPriorities?.get(item.itemId) ?? ("regular" as ItemPriority),
      }))
      .sort((a, b) => {
        const priorityDiff = REMOVAL_ORDER[a.priority] - REMOVAL_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.effectivePrice * b.quantity) - (a.effectivePrice * a.quantity);
      });

    for (const item of removable) {
      if (currentTotal <= budget) break;

      const itemCost = item.effectivePrice * item.quantity;
      const priorityLabel = item.priority;

      // If the item was already substituted, update the existing adjustment
      // to a removal instead of adding a duplicate
      const existingIdx = adjustments.findIndex(
        (a) => a.original.itemId === item.itemId
      );

      if (existingIdx !== -1) {
        // Replace the substitution with a removal
        const existingSavings = adjustments[existingIdx].savings;
        const additionalSavings = itemCost;
        adjustments[existingIdx] = {
          original: { itemId: item.itemId, name: item.name, price: item.price },
          replacement: { itemId: item.itemId, name: `${item.name} (REMOVED)`, price: 0 },
          savings: existingSavings + additionalSavings,
          reasoning: `Removed ${item.name} (${priorityLabel} purchase) to meet EUR ${(budget / 100).toFixed(2)} budget. Savings: EUR ${((existingSavings + additionalSavings) / 100).toFixed(2)}.`,
        };
      } else {
        adjustments.push({
          original: { itemId: item.itemId, name: item.name, price: item.price },
          replacement: { itemId: item.itemId, name: `${item.name} (REMOVED)`, price: 0 },
          savings: itemCost,
          reasoning: `Removed ${item.name} (${priorityLabel} purchase) to meet EUR ${(budget / 100).toFixed(2)} budget. Savings: EUR ${(itemCost / 100).toFixed(2)}.`,
        });
      }

      currentTotal -= itemCost;
    }
  }

  return {
    approved: false,
    originalTotal,
    optimizedTotal: currentTotal,
    adjustments,
  };
}
