import { generateObject } from "ai";
import { getModel } from "@/lib/ai/models";
import { parsedIntentSchema } from "./schemas";
import type { ParsedIntent } from "@/types";

/**
 * Parse a natural-language user input into a structured ParsedIntent.
 *
 * Uses an LLM call for robustness -- handles typos, varied phrasing, and
 * implicit guest counts (e.g. "friends over" defaults to 4).
 *
 * Falls back to an empty intent if the LLM call fails.
 */
export async function parseIntent(rawInput: string): Promise<ParsedIntent> {
  try {
    const result = await generateObject({
      mode: "tool",
      model: getModel("meal-planner"),
      schema: parsedIntentSchema,
      system: `You are a grocery intent parser. Extract structured information from the user's natural-language request about their weekly grocery shop.

Rules:
- Extract specific meals with their day of the week (e.g. "lasagna Wednesday" -> { day: "Wednesday", dish: "lasagna" })
- Extract guest events with estimated guest count. If no count given, default to 4 (e.g. "friends Saturday" -> { day: "Saturday", guestCount: 4, description: "friends coming over" })
- Extract budget in euro cents. "under 80 euro" -> 8000, "max 50" -> 5000. If no budget mentioned, set budget to null.
- Extract any special dietary requests or preferences as specialRequests (e.g. "no gluten", "vegetarian", "extra fruit")
- Days should be capitalized (Monday, Tuesday, etc.)
- Always set rawInput to the original user input verbatim`,
      prompt: rawInput,
    });

    return result.object;
  } catch (error) {
    console.error("Intent parsing failed, returning empty intent:", error);
    return {
      rawInput,
      meals: [],
      guestEvents: [],
      budget: null,
      specialRequests: [],
    };
  }
}
