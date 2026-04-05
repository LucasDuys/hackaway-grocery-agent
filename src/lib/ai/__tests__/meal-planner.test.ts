import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MealPlanner, type MealPlanInput } from '../meal-planner'
import type { MealPlan } from '../schemas'

// ---------------------------------------------------------------------------
// Mock the Vercel AI SDK generateObject
// ---------------------------------------------------------------------------

const mockGenerateObject = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: (model: string) => ({ modelId: model }),
}))

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeMockMealPlan(overrides?: Partial<MealPlan>): MealPlan {
  return {
    days: [
      {
        dayNumber: 1,
        meals: [
          {
            name: 'Boterham met kaas',
            type: 'breakfast',
            servings: 2,
            ingredients: [
              { name: 'Brood', quantity: '4 sneetjes', estimatedPriceCents: 60 },
              { name: 'Kaas', quantity: '4 plakken', estimatedPriceCents: 80 },
            ],
            estimatedTotalCents: 140,
            preparationTimeMinutes: 5,
            tags: ['quick'],
          },
          {
            name: 'Tosti ham-kaas',
            type: 'lunch',
            servings: 2,
            ingredients: [
              { name: 'Brood', quantity: '4 sneetjes', estimatedPriceCents: 60 },
              { name: 'Ham', quantity: '4 plakken', estimatedPriceCents: 100 },
              { name: 'Kaas', quantity: '4 plakken', estimatedPriceCents: 80 },
            ],
            estimatedTotalCents: 240,
            preparationTimeMinutes: 10,
          },
          {
            name: 'Stamppot boerenkool',
            type: 'dinner',
            servings: 2,
            ingredients: [
              { name: 'Aardappelen', quantity: '500g', estimatedPriceCents: 100 },
              { name: 'Boerenkool', quantity: '300g', estimatedPriceCents: 150 },
              { name: 'Rookworst', quantity: '1 stuk', estimatedPriceCents: 250 },
            ],
            estimatedTotalCents: 500,
            preparationTimeMinutes: 35,
            tags: ['traditional', 'dutch'],
          },
        ],
        dayTotalCents: 880,
      },
    ],
    totalCostCents: 880,
    shoppingList: [
      { ingredientName: 'Brood', totalQuantity: '8 sneetjes', estimatedPriceCents: 120 },
      { ingredientName: 'Kaas', totalQuantity: '8 plakken', estimatedPriceCents: 160 },
      { ingredientName: 'Ham', totalQuantity: '4 plakken', estimatedPriceCents: 100 },
      { ingredientName: 'Aardappelen', totalQuantity: '500g', estimatedPriceCents: 100 },
      { ingredientName: 'Boerenkool', totalQuantity: '300g', estimatedPriceCents: 150 },
      { ingredientName: 'Rookworst', totalQuantity: '1 stuk', estimatedPriceCents: 250 },
    ],
    ...overrides,
  }
}

const DEFAULT_INPUT: MealPlanInput = {
  budgetCents: 5000,
  days: 1,
  householdSize: 2,
  dietaryRestrictions: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MealPlanner', () => {
  let planner: MealPlanner

  beforeEach(() => {
    planner = new MealPlanner()
    mockGenerateObject.mockReset()
  })

  it('returns a structured meal plan with correct schema', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    const result = await planner.generatePlan(DEFAULT_INPUT)

    expect(result.mealPlan).toEqual(mockPlan)
    expect(result.mealPlan.days).toHaveLength(1)
    expect(result.mealPlan.days[0].meals).toHaveLength(3)
    expect(result.totalCostCents).toBe(880)
    expect(result.shoppingList).toHaveLength(6)
  })

  it('enforces budget -- total does not exceed budget', async () => {
    const mockPlan = makeMockMealPlan({ totalCostCents: 4500 })
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    const result = await planner.generatePlan({ ...DEFAULT_INPUT, budgetCents: 5000 })

    expect(result.totalCostCents).toBeLessThanOrEqual(5000)
  })

  it('passes dietary restrictions to the system prompt', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    await planner.generatePlan({
      ...DEFAULT_INPUT,
      dietaryRestrictions: ['vegetarian', 'gluten-free'],
    })

    // Verify generateObject was called with a system prompt containing the restrictions
    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.system).toContain('vegetarian')
    expect(callArgs.system).toContain('gluten-free')
  })

  it('includes preferences in the system prompt when provided', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    await planner.generatePlan({
      ...DEFAULT_INPUT,
      preferences: 'I like Italian food',
    })

    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.system).toContain('I like Italian food')
  })

  it('shopping list aggregates ingredients from the meal plan', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    const result = await planner.generatePlan(DEFAULT_INPUT)

    // The shopping list should have entries for each unique ingredient
    const ingredientNames = result.shoppingList.map((item) => item.ingredientName)
    expect(ingredientNames).toContain('Brood')
    expect(ingredientNames).toContain('Kaas')
    expect(ingredientNames).toContain('Rookworst')

    // Each item should have a price
    for (const item of result.shoppingList) {
      expect(item.estimatedPriceCents).toBeGreaterThan(0)
    }
  })

  it('handles LLM error gracefully', async () => {
    mockGenerateObject.mockRejectedValue(new Error('OpenAI API rate limit exceeded'))

    await expect(planner.generatePlan(DEFAULT_INPUT)).rejects.toThrow(
      'OpenAI API rate limit exceeded',
    )
  })

  it('handles empty days array', async () => {
    const mockPlan = makeMockMealPlan({
      days: [],
      totalCostCents: 0,
      shoppingList: [],
    })
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    const result = await planner.generatePlan(DEFAULT_INPUT)

    expect(result.mealPlan.days).toHaveLength(0)
    expect(result.totalCostCents).toBe(0)
    expect(result.shoppingList).toHaveLength(0)
  })

  it('uses gpt-4.1-mini model', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    await planner.generatePlan(DEFAULT_INPUT)

    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.model).toEqual({ modelId: 'gpt-4.1-mini' })
  })

  it('includes Dutch cuisine context in system prompt', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    await planner.generatePlan(DEFAULT_INPUT)

    const callArgs = mockGenerateObject.mock.calls[0][0]
    expect(callArgs.system).toContain('Dutch')
    expect(callArgs.system).toContain('Albert Heijn')
  })

  it('calculates budget per day correctly in prompt', async () => {
    const mockPlan = makeMockMealPlan()
    mockGenerateObject.mockResolvedValue({ object: mockPlan })

    await planner.generatePlan({
      ...DEFAULT_INPUT,
      budgetCents: 7000,
      days: 7,
    })

    const callArgs = mockGenerateObject.mock.calls[0][0]
    // 7000 / 7 / 100 = 10.00 EUR per day
    expect(callArgs.system).toContain('10.00')
  })
})
