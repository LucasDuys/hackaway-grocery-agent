import { z } from 'zod'

export const mealSchema = z.object({
  name: z.string(),
  type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number(),
  ingredients: z.array(z.object({
    name: z.string(),
    quantity: z.string(),
    unitType: z.string().optional(),
    estimatedPriceCents: z.number().optional(),
  })),
  estimatedTotalCents: z.number(),
  preparationTimeMinutes: z.number(),
  tags: z.array(z.string()).optional(),
})

export const mealPlanSchema = z.object({
  days: z.array(z.object({
    dayNumber: z.number(),
    meals: z.array(mealSchema),
    dayTotalCents: z.number(),
  })),
  totalCostCents: z.number(),
  shoppingList: z.array(z.object({
    ingredientName: z.string(),
    totalQuantity: z.string(),
    estimatedPriceCents: z.number(),
  })),
})

export type MealPlan = z.infer<typeof mealPlanSchema>
export type Meal = z.infer<typeof mealSchema>
