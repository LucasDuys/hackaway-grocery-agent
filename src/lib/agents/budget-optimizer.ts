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

/**
 * Run the Budget Optimizer agent.
 *
 * When the merged cart exceeds the user's budget, identifies expensive items,
 * finds cheaper alternatives, and produces detailed per-item substitution reasoning.
 * This is the key demo moment -- judges see the reasoning for each swap.
 */
export async function runBudgetOptimizer(
  cartItems: CartItemInput[],
  budget: number, // cents
  alternatives: Map<string, Array<{ itemId: string; name: string; price: number }>>
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

  // No alternatives available -- cannot optimize, return unapproved
  if (alternatives.size === 0) {
    return {
      approved: false,
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

  try {
    const result = await generateObject({
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
        productAlternatives
      ),
      prompt:
        "Optimize this cart to fit within the budget. Provide detailed reasoning for every substitution.",
    });

    return result.object;
  } catch (error) {
    console.error("Budget Optimizer failed, returning fallback:", error);

    // Fallback: attempt a simple greedy substitution without the LLM
    return buildFallbackOptimization(cartItems, budget, alternatives);
  }
}

/**
 * Greedy fallback when the LLM call fails.
 * Sorts items by price descending, swaps in cheapest alternative until under budget.
 */
function buildFallbackOptimization(
  cartItems: CartItemInput[],
  budget: number,
  alternatives: Map<string, Array<{ itemId: string; name: string; price: number }>>
): BudgetOptimizerOutput {
  const originalTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const adjustments: BudgetOptimizerOutput["adjustments"] = [];
  let currentTotal = originalTotal;

  // Sort by unit price descending to maximize savings from each swap
  const sortedItems = [...cartItems].sort((a, b) => b.price - a.price);

  for (const item of sortedItems) {
    if (currentTotal <= budget) break;

    const itemAlts = alternatives.get(item.itemId);
    if (!itemAlts || itemAlts.length === 0) continue;

    // Find the cheapest alternative that is actually cheaper
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
      reasoning: `Replaced ${item.name} (EUR ${(item.price / 100).toFixed(2)}) with ${cheapest.name} (EUR ${(cheapest.price / 100).toFixed(2)}). Savings: EUR ${(savings / 100).toFixed(2)}. Fallback substitution applied due to optimizer error.`,
    });

    currentTotal -= savings;
  }

  return {
    approved: false,
    originalTotal,
    optimizedTotal: currentTotal,
    adjustments,
  };
}
