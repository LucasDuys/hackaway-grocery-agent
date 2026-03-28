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
      model: getModel("meal-planner"),
      schema: parsedIntentSchema,
      system: `You are a grocery intent parser. Extract structured information from the user's natural-language request about their weekly grocery shop.

Rules:
- Extract specific meals with their day of the week (e.g. "lasagna Wednesday" -> { day: "Wednesday", dish: "lasagna", goalBased: false })
- Extract guest events with estimated guest count. If no count given, default to 4 (e.g. "friends Saturday" -> { day: "Saturday", guestCount: 4, description: "friends coming over" })
- Extract budget in euro cents. "under 80 euro" -> 8000, "max 50" -> 5000. If no budget mentioned, set budget to null.
- Extract any special dietary requests or preferences as specialRequests (e.g. "no gluten", "vegetarian", "extra fruit")
- IMPORTANT: If a guest event description mentions dietary restrictions for guests (e.g. "friends Saturday one is vegan", "vegetarian guests Friday"), include those dietary mentions in the specialRequests array with the day context (e.g. "Saturday guests: one is vegan"). This ensures the meal planner can apply guest-specific dietary restrictions only to that day's meal.
- Days should be capitalized (Monday, Tuesday, etc.)
- Always set rawInput to the original user input verbatim

Goal-based meal requests:
- When the user asks for meals described by a goal or attribute rather than a specific dish (e.g. "high protein", "low carb", "healthy", "easy", "quick", "vegetarian", "light"), create meal entries with goalBased set to true.
- The dish field should capture the user's goal description (e.g. "high protein meal", "easy meal", "light meal").
- If the user says "meal week" or "meals for the week" or similar, expand to Monday through Friday: 5 meal entries, one per weekday.
- If the user specifies a single day with a goal (e.g. "something light on Tuesday"), create one entry for that day with goalBased: true.

Product/snack requests:
- When the user asks for specific products or snacks (e.g. "some chocolate snacks", "grab some chips", "get me some yogurt"), extract search terms into the productSearchQueries array.
- Translate common product terms to Dutch for Picnic search (e.g. "chocolate" -> "chocolade", "chips" -> "chips", "yogurt" -> "yoghurt").
- Also add the product request to specialRequests for context.

Mixed requests:
- A single input can contain specific dishes, goal-based meals, product requests, and guest events simultaneously.
- For "the rest of the week" or similar phrasing, fill in goal-based meals for all weekdays not already covered by a specific dish or guest event.

Nutritional targets:
- Specific nutritional targets like "150g protein per day" or "under 2000 calories" go into specialRequests (e.g. "150g protein per day target").

Few-shot examples:

User: "high protein meal week"
Result: meals = [
  { day: "Monday", dish: "high protein meal", goalBased: true },
  { day: "Tuesday", dish: "high protein meal", goalBased: true },
  { day: "Wednesday", dish: "high protein meal", goalBased: true },
  { day: "Thursday", dish: "high protein meal", goalBased: true },
  { day: "Friday", dish: "high protein meal", goalBased: true }
], specialRequests = [], productSearchQueries = [], budget = null

User: "lasagna Wednesday, healthy meals the rest of the week, some chocolate"
Result: meals = [
  { day: "Monday", dish: "healthy meal", goalBased: true },
  { day: "Tuesday", dish: "healthy meal", goalBased: true },
  { day: "Wednesday", dish: "lasagna", goalBased: false },
  { day: "Thursday", dish: "healthy meal", goalBased: true },
  { day: "Friday", dish: "healthy meal", goalBased: true }
], specialRequests = ["chocolate snacks requested"], productSearchQueries = ["chocolade"], budget = null

User: "something light on Tuesday, 150g protein per day, grab some chips"
Result: meals = [
  { day: "Tuesday", dish: "light meal", goalBased: true }
], specialRequests = ["150g protein per day target", "chips requested"], productSearchQueries = ["chips"], budget = null`,
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
