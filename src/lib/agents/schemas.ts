import { z } from "zod";

// === Shared enums ===

const reasonTagSchema = z.enum([
  "repeat",
  "substitution",
  "recipe",
  "suggestion",
  "overdue",
  "co-purchase",
]);

// === Recommendation schema (shared by OrderAnalyst and MealPlanner) ===

const recommendationSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  score: z.number().min(0).max(100),
  reason: z.string(),
  reasonTag: reasonTagSchema,
  suggestedQuantity: z.number().int().min(1),
  lastBought: z.string(), // ISO date
  pricePerUnit: z.number().int(), // cents
});

// === OrderAnalystOutput ===

export const orderAnalystSchema = z.object({
  recommendedItems: z.array(recommendationSchema),
  totalEstimatedCost: z.number().int(), // cents
  householdInsight: z.string(),
});

// === MealPlannerOutput ===

export const mealPlannerSchema = z.object({
  meals: z.array(
    z.object({
      day: z.string(),
      mealName: z.string(),
      ingredients: z.array(
        z.object({
          itemId: z.string(),
          name: z.string(),
          quantity: z.number().int().min(1),
          price: z.number().int(), // cents per unit
        })
      ),
      estimatedCost: z.number().int(), // cents
      portionSize: z.number().int().min(1),
    })
  ),
  additionalIngredients: z.array(recommendationSchema),
});

// === ScheduleAgentOutput ===

export const scheduleAgentSchema = z.object({
  selectedSlot: z.object({
    slotId: z.string(),
    date: z.string(), // YYYY-MM-DD
    timeWindow: z.string(), // e.g. "10:00 - 12:00"
    reasoning: z.string(),
  }),
});

// === BudgetOptimizerOutput ===

export const budgetOptimizerSchema = z.object({
  approved: z.boolean(),
  originalTotal: z.number().int(), // cents
  optimizedTotal: z.number().int(), // cents
  adjustments: z.array(
    z.object({
      original: z.object({
        itemId: z.string(),
        name: z.string(),
        price: z.number().int(),
      }),
      replacement: z.object({
        itemId: z.string(),
        name: z.string(),
        price: z.number().int(),
      }),
      savings: z.number().int(), // cents
      reasoning: z.string(),
    })
  ),
});

// === ParsedIntent ===

export const parsedIntentSchema = z.object({
  rawInput: z.string(),
  meals: z.array(
    z.object({
      day: z.string(),
      dish: z.string(),
      goalBased: z.boolean().optional(),
    })
  ),
  guestEvents: z.array(
    z.object({
      day: z.string(),
      guestCount: z.number().int().min(1),
      description: z.string(),
    })
  ),
  budget: z.number().int().nullable(), // cents, null = no explicit budget
  specialRequests: z.array(z.string()),
  productSearchQueries: z.array(z.string()).optional(),
});
