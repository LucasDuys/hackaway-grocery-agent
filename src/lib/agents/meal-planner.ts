import { generateObject } from "ai";
import { getModel } from "@/lib/ai/models";
import { buildMealPlannerPrompt } from "@/lib/prompts/meal-planner";
import { mealPlannerSchema } from "./schemas";
import type {
  ParsedIntent,
  PicnicData,
  OrderAnalystOutput,
  MealPlannerOutput,
  PicnicCartItem,
} from "@/types";

/**
 * Run the Meal Planner agent.
 *
 * Plans meals for the week based on user intent, cross-references with the
 * base cart from the Order Analyst to avoid duplicate items, and adjusts
 * portions for guest events.
 */
export async function runMealPlanner(
  intent: ParsedIntent,
  data: PicnicData,
  baseCart: OrderAnalystOutput
): Promise<MealPlannerOutput> {
  try {
    // Flatten all available products from search results for the product catalog
    const allProducts = [
      ...data.favorites,
      ...Object.values(data.searchResults).flat(),
    ];

    // Build the base cart items list: current cart + order analyst recommendations
    const baseCartItems: PicnicCartItem[] = [
      ...data.cart,
      ...baseCart.recommendedItems.map((item) => ({
        selling_unit_id: item.itemId,
        name: item.name,
        quantity: item.suggestedQuantity,
        price: item.pricePerUnit,
      })),
    ];

    const result = await generateObject({
      model: getModel("meal-planner"),
      schema: mealPlannerSchema,
      system: buildMealPlannerPrompt(
        intent,
        data.recipes,
        allProducts,
        baseCartItems
      ),
      prompt:
        "Plan meals for the week based on the user's requests. Map ingredients to concrete products, avoid duplicates with the base cart, and adjust portions for any guest events.",
    });

    return result.object;
  } catch (error) {
    console.error("Meal Planner failed, returning empty output:", error);
    return {
      meals: [],
      additionalIngredients: [],
    };
  }
}
