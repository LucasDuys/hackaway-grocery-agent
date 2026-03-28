import { generateObject } from "ai";
import { getModel } from "@/lib/ai/models";
import { buildOrderAnalystPrompt } from "@/lib/prompts/order-analyst";
import { orderAnalystSchema } from "./schemas";
import type { AnalysisResult, PicnicData, OrderAnalystOutput } from "@/types";

/**
 * Run the Order Analyst agent.
 *
 * Analyzes purchase history and recommends items for this week's shop.
 * All data is pre-injected via the system prompt (fat context pattern).
 */
export async function runOrderAnalyst(
  analysis: AnalysisResult,
  data: PicnicData,
  budgetCents?: number | null,
  preferencesContext?: string
): Promise<OrderAnalystOutput> {
  try {
    const result = await generateObject({
      model: getModel("order-analyst"),
      schema: orderAnalystSchema,
      system: buildOrderAnalystPrompt(analysis, data, budgetCents, preferencesContext),
      prompt:
        "Analyze the order history and recommend items for this week's shop.",
    });

    return result.object;
  } catch (error) {
    console.error("Order Analyst failed, returning empty output:", error);
    return {
      recommendedItems: [],
      totalEstimatedCost: 0,
      householdInsight:
        "Unable to analyze order history at this time. Please try again.",
    };
  }
}
