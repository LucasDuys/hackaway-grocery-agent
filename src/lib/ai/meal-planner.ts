import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mealPlanSchema, type MealPlan } from './schemas'
import type { OptimizationResult } from '../optimizer/types'

export interface MealPlanInput {
  budgetCents: number
  days: number
  householdSize: number
  dietaryRestrictions: string[]
  preferences?: string
}

export interface ShoppingListItem {
  ingredientName: string
  totalQuantity: string
  estimatedPriceCents: number
}

export interface MealPlanResult {
  mealPlan: MealPlan
  shoppingList: ShoppingListItem[]
  optimizedResult?: OptimizationResult
  totalCostCents: number
}

export class MealPlanner {
  /**
   * Generate a meal plan using OpenAI structured outputs.
   * Returns a structured meal plan with shopping list and cost breakdown.
   */
  async generatePlan(input: MealPlanInput): Promise<MealPlanResult> {
    const systemPrompt = this.buildSystemPrompt(input)

    const result = await generateObject({
      model: openai('gpt-4.1-mini'),
      schema: mealPlanSchema,
      system: systemPrompt,
      prompt: `Create a ${input.days}-day meal plan for ${input.householdSize} people with a total budget of ${(input.budgetCents / 100).toFixed(2)} EUR.`,
    })

    const mealPlan = result.object

    return {
      mealPlan,
      shoppingList: mealPlan.shoppingList,
      totalCostCents: mealPlan.totalCostCents,
    }
  }

  private buildSystemPrompt(input: MealPlanInput): string {
    const budgetEuros = (input.budgetCents / 100).toFixed(2)
    const perDayBudget = (input.budgetCents / input.days / 100).toFixed(2)

    const restrictionsBlock = input.dietaryRestrictions.length > 0
      ? `\nDietary restrictions (must follow strictly): ${input.dietaryRestrictions.join(', ')}`
      : ''

    const preferencesBlock = input.preferences
      ? `\nUser preferences: ${input.preferences}`
      : ''

    return `You are a practical meal planning assistant for Dutch households.

Your job is to create realistic, budget-friendly meal plans using ingredients commonly found in Dutch supermarkets (Albert Heijn, Jumbo, Lidl, Aldi, Plus).

Rules:
- All prices must be in euro cents (integers). Use realistic Dutch supermarket prices.
- The total cost across all days MUST NOT exceed the budget of ${budgetEuros} EUR (${input.budgetCents} cents).
- Budget per day is approximately ${perDayBudget} EUR.
- Plan for ${input.householdSize} people per meal.
- Include breakfast, lunch, and dinner for each day. Snacks are optional.
- Use common Dutch ingredients: bread, cheese, eggs, milk, potatoes, vegetables, chicken, minced meat, pasta, rice.
- Suggest practical portions -- not restaurant-sized.
- The shopping list must aggregate all ingredients across all days with total quantities.
- Each shopping list item must have a realistic estimated price in cents.
- The sum of all shopping list item prices should approximate the totalCostCents.
- Preparation times should be realistic (breakfast 5-15 min, lunch 10-20 min, dinner 20-45 min).
${restrictionsBlock}${preferencesBlock}

Output format: Follow the schema exactly. All monetary values are in euro cents (integers).`
  }
}
