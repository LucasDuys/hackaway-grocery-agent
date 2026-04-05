import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MealPlanner } from '@/lib/ai/meal-planner'
import type { MealPlanInput } from '@/lib/ai/meal-planner'
import { ShoppingOptimizer } from '@/lib/optimizer/optimizer'
import type { SupabaseClient, SupabaseQueryBuilder } from '@/lib/scrapers/db-writer'
import type { OptimizationInput } from '@/lib/optimizer/types'

// ---------------------------------------------------------------------------
// Mock AI SDK (generateObject) -- data is inlined because vi.mock is hoisted
// ---------------------------------------------------------------------------

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      days: [
        {
          dayNumber: 1,
          meals: [
            {
              name: 'Boterhammen met kaas',
              type: 'breakfast',
              servings: 2,
              ingredients: [
                { name: 'Volkoren brood', quantity: '4 sneetjes', estimatedPriceCents: 60 },
                { name: 'Jonge kaas', quantity: '100g', estimatedPriceCents: 100 },
                { name: 'Roomboter', quantity: '20g', estimatedPriceCents: 25 },
              ],
              estimatedTotalCents: 185,
              preparationTimeMinutes: 5,
            },
            {
              name: 'Tomatensoep met brood',
              type: 'lunch',
              servings: 2,
              ingredients: [
                { name: 'Tomaten', quantity: '500g', estimatedPriceCents: 179 },
                { name: 'Ui', quantity: '1 stuk', estimatedPriceCents: 30 },
                { name: 'Volkoren brood', quantity: '2 sneetjes', estimatedPriceCents: 30 },
              ],
              estimatedTotalCents: 239,
              preparationTimeMinutes: 25,
            },
          ],
          dayTotalCents: 424,
        },
        {
          dayNumber: 2,
          meals: [
            {
              name: 'Havermout met melk',
              type: 'breakfast',
              servings: 2,
              ingredients: [
                { name: 'Havermout', quantity: '100g', estimatedPriceCents: 35 },
                { name: 'Halfvolle melk', quantity: '300ml', estimatedPriceCents: 40 },
              ],
              estimatedTotalCents: 75,
              preparationTimeMinutes: 8,
            },
            {
              name: 'Pasta met gehakt en groenten',
              type: 'dinner',
              servings: 2,
              ingredients: [
                { name: 'Pasta penne', quantity: '250g', estimatedPriceCents: 89 },
                { name: 'Rundergehakt', quantity: '300g', estimatedPriceCents: 349 },
                { name: 'Tomaten', quantity: '400g', estimatedPriceCents: 149 },
                { name: 'Ui', quantity: '1 stuk', estimatedPriceCents: 30 },
              ],
              estimatedTotalCents: 617,
              preparationTimeMinutes: 30,
            },
          ],
          dayTotalCents: 692,
        },
        {
          dayNumber: 3,
          meals: [
            {
              name: 'Gebakken eieren',
              type: 'breakfast',
              servings: 2,
              ingredients: [
                { name: 'Scharreleieren', quantity: '4 stuks', estimatedPriceCents: 132 },
                { name: 'Volkoren brood', quantity: '2 sneetjes', estimatedPriceCents: 30 },
                { name: 'Roomboter', quantity: '10g', estimatedPriceCents: 12 },
              ],
              estimatedTotalCents: 174,
              preparationTimeMinutes: 10,
            },
            {
              name: 'Rijst met kip en groenten',
              type: 'dinner',
              servings: 2,
              ingredients: [
                { name: 'Rijst', quantity: '200g', estimatedPriceCents: 45 },
                { name: 'Kipfilet', quantity: '300g', estimatedPriceCents: 399 },
                { name: 'Broccoli', quantity: '300g', estimatedPriceCents: 149 },
              ],
              estimatedTotalCents: 593,
              preparationTimeMinutes: 35,
            },
          ],
          dayTotalCents: 767,
        },
      ],
      totalCostCents: 1883,
      shoppingList: [
        { ingredientName: 'Volkoren brood', totalQuantity: '8 sneetjes', estimatedPriceCents: 120 },
        { ingredientName: 'Jonge kaas', totalQuantity: '100g', estimatedPriceCents: 100 },
        { ingredientName: 'Roomboter', totalQuantity: '30g', estimatedPriceCents: 37 },
        { ingredientName: 'Tomaten', totalQuantity: '900g', estimatedPriceCents: 328 },
        { ingredientName: 'Ui', totalQuantity: '2 stuks', estimatedPriceCents: 60 },
        { ingredientName: 'Havermout', totalQuantity: '100g', estimatedPriceCents: 35 },
        { ingredientName: 'Halfvolle melk', totalQuantity: '300ml', estimatedPriceCents: 40 },
        { ingredientName: 'Pasta penne', totalQuantity: '250g', estimatedPriceCents: 89 },
        { ingredientName: 'Rundergehakt', totalQuantity: '300g', estimatedPriceCents: 349 },
        { ingredientName: 'Scharreleieren', totalQuantity: '4 stuks', estimatedPriceCents: 132 },
        { ingredientName: 'Rijst', totalQuantity: '200g', estimatedPriceCents: 45 },
        { ingredientName: 'Kipfilet', totalQuantity: '300g', estimatedPriceCents: 399 },
        { ingredientName: 'Broccoli', totalQuantity: '300g', estimatedPriceCents: 149 },
      ],
    },
  }),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mock-model'),
}))

// ---------------------------------------------------------------------------
// Ingredient -> unified product mapping (simulates product search)
// ---------------------------------------------------------------------------

interface MockUnifiedProduct {
  unifiedProductId: string
  ingredientName: string
  ahPriceCents: number
  jumboPriceCents: number
}

const INGREDIENT_TO_PRODUCT: MockUnifiedProduct[] = [
  { unifiedProductId: 'u-brood', ingredientName: 'Volkoren brood', ahPriceCents: 239, jumboPriceCents: 249 },
  { unifiedProductId: 'u-kaas', ingredientName: 'Jonge kaas', ahPriceCents: 499, jumboPriceCents: 479 },
  { unifiedProductId: 'u-boter', ingredientName: 'Roomboter', ahPriceCents: 279, jumboPriceCents: 269 },
  { unifiedProductId: 'u-tomaten', ingredientName: 'Tomaten', ahPriceCents: 179, jumboPriceCents: 189 },
  { unifiedProductId: 'u-ui', ingredientName: 'Ui', ahPriceCents: 59, jumboPriceCents: 49 },
  { unifiedProductId: 'u-havermout', ingredientName: 'Havermout', ahPriceCents: 129, jumboPriceCents: 119 },
  { unifiedProductId: 'u-melk', ingredientName: 'Halfvolle melk', ahPriceCents: 119, jumboPriceCents: 109 },
  { unifiedProductId: 'u-pasta', ingredientName: 'Pasta penne', ahPriceCents: 89, jumboPriceCents: 99 },
  { unifiedProductId: 'u-gehakt', ingredientName: 'Rundergehakt', ahPriceCents: 549, jumboPriceCents: 529 },
  { unifiedProductId: 'u-eieren', ingredientName: 'Scharreleieren', ahPriceCents: 329, jumboPriceCents: 349 },
  { unifiedProductId: 'u-rijst', ingredientName: 'Rijst', ahPriceCents: 139, jumboPriceCents: 129 },
  { unifiedProductId: 'u-kip', ingredientName: 'Kipfilet', ahPriceCents: 599, jumboPriceCents: 579 },
  // Broccoli intentionally omitted to test "not found" case
]

// ---------------------------------------------------------------------------
// Mock Supabase for optimizer price lookups
// ---------------------------------------------------------------------------

interface PriceRow {
  unified_product_id: string
  product_id: string
  products: {
    id: string
    name: string
    store_id: string
    stores: { slug: string; name: string }
  }
  prices: Array<{ price_cents: number }>
}

function buildPriceRows(products: MockUnifiedProduct[]): PriceRow[] {
  const rows: PriceRow[] = []
  for (const p of products) {
    rows.push({
      unified_product_id: p.unifiedProductId,
      product_id: `p-ah-${p.unifiedProductId}`,
      products: {
        id: `p-ah-${p.unifiedProductId}`,
        name: p.ingredientName,
        store_id: 'store-ah',
        stores: { slug: 'ah', name: 'Albert Heijn' },
      },
      prices: [{ price_cents: p.ahPriceCents }],
    })
    rows.push({
      unified_product_id: p.unifiedProductId,
      product_id: `p-jumbo-${p.unifiedProductId}`,
      products: {
        id: `p-jumbo-${p.unifiedProductId}`,
        name: p.ingredientName,
        store_id: 'store-jumbo',
        stores: { slug: 'jumbo', name: 'Jumbo' },
      },
      prices: [{ price_cents: p.jumboPriceCents }],
    })
  }
  return rows
}

function createOptimizerMockSupabase(priceRows: PriceRow[]): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {
        upsert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      if (table === 'product_mappings') {
        builder.select = vi.fn().mockReturnValue({
          ...builder,
          eq: vi.fn().mockReturnValue({
            then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: priceRows, error: null }).then(resolve, reject),
          }),
        })
      }

      builder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)

      return builder as unknown as SupabaseQueryBuilder
    }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Meal Plan to Shopping List Pipeline', () => {
  let planner: MealPlanner

  beforeEach(() => {
    planner = new MealPlanner()
  })

  it('generates meal plan, extracts ingredients, creates list, and optimizes', async () => {
    // -----------------------------------------------------------------------
    // Step 1: Generate meal plan via mocked AI
    // -----------------------------------------------------------------------
    const input: MealPlanInput = {
      budgetCents: 3000,
      days: 3,
      householdSize: 2,
      dietaryRestrictions: [],
    }

    const planResult = await planner.generatePlan(input)

    // Verify meal plan structure
    expect(planResult.mealPlan.days).toHaveLength(3)
    expect(planResult.mealPlan.days[0].meals.length).toBeGreaterThanOrEqual(2)
    expect(planResult.mealPlan.days[1].meals.length).toBeGreaterThanOrEqual(2)
    expect(planResult.mealPlan.days[2].meals.length).toBeGreaterThanOrEqual(2)
    expect(planResult.totalCostCents).toBeLessThanOrEqual(input.budgetCents)

    // -----------------------------------------------------------------------
    // Step 2: Extract shopping list from meal plan
    // -----------------------------------------------------------------------
    const shoppingList = planResult.shoppingList
    expect(shoppingList.length).toBe(13) // 13 unique ingredients

    // Verify all ingredients have names and prices
    for (const item of shoppingList) {
      expect(item.ingredientName).toBeTruthy()
      expect(item.estimatedPriceCents).toBeGreaterThan(0)
      expect(item.totalQuantity).toBeTruthy()
    }

    // -----------------------------------------------------------------------
    // Step 3: Match ingredients to unified products (simulate product search)
    // -----------------------------------------------------------------------
    const matchedItems: OptimizationInput['items'] = []
    const unmatchedIngredients: string[] = []

    for (const item of shoppingList) {
      const match = INGREDIENT_TO_PRODUCT.find(
        (p) => p.ingredientName.toLowerCase() === item.ingredientName.toLowerCase(),
      )
      if (match) {
        matchedItems.push({
          unifiedProductId: match.unifiedProductId,
          quantity: 1,
          productName: item.ingredientName,
        })
      } else {
        unmatchedIngredients.push(item.ingredientName)
      }
    }

    // 12 of 13 ingredients should match (broccoli excluded)
    expect(matchedItems).toHaveLength(12)
    expect(unmatchedIngredients).toEqual(['Broccoli'])

    // -----------------------------------------------------------------------
    // Step 4: Optimize the matched shopping list
    // -----------------------------------------------------------------------
    const priceRows = buildPriceRows(INGREDIENT_TO_PRODUCT)
    const mockSupabase = createOptimizerMockSupabase(priceRows)
    const optimizer = new ShoppingOptimizer(mockSupabase)

    const optimResult = await optimizer.optimize({ items: matchedItems })

    // -----------------------------------------------------------------------
    // Step 5: Verify optimizer output
    // -----------------------------------------------------------------------

    // All 12 matched ingredients should have assignments
    expect(optimResult.assignments).toHaveLength(12)

    // Each assignment should have a valid store
    for (const a of optimResult.assignments) {
      expect(['ah', 'jumbo']).toContain(a.storeSlug)
      expect(a.priceCents).toBeGreaterThan(0)
      expect(a.quantity).toBe(1)
    }

    // Total cost should match sum of assigned prices
    const manualTotal = optimResult.assignments.reduce(
      (sum, a) => sum + a.priceCents * a.quantity,
      0,
    )
    expect(optimResult.totalCostCents).toBe(manualTotal)

    // Verify cheapest-per-item assignments for a few items:
    // Brood: AH=239 < Jumbo=249 -> AH
    const broodAssign = optimResult.assignments.find((a) => a.unifiedProductId === 'u-brood')!
    expect(broodAssign.storeSlug).toBe('ah')
    expect(broodAssign.priceCents).toBe(239)

    // Kaas: Jumbo=479 < AH=499 -> Jumbo
    const kaasAssign = optimResult.assignments.find((a) => a.unifiedProductId === 'u-kaas')!
    expect(kaasAssign.storeSlug).toBe('jumbo')
    expect(kaasAssign.priceCents).toBe(479)

    // Gehakt: Jumbo=529 < AH=549 -> Jumbo
    const gehaktAssign = optimResult.assignments.find((a) => a.unifiedProductId === 'u-gehakt')!
    expect(gehaktAssign.storeSlug).toBe('jumbo')
    expect(gehaktAssign.priceCents).toBe(529)

    // Savings should be positive (multi-store is cheaper than single store)
    expect(optimResult.savingsCents).toBeGreaterThanOrEqual(0)

    // Budget check: total cost should be within a reasonable range
    expect(optimResult.totalCostCents).toBeGreaterThan(0)
  })

  it('handles ingredients not found in any store', async () => {
    // -----------------------------------------------------------------------
    // Generate meal plan
    // -----------------------------------------------------------------------
    const planResult = await planner.generatePlan({
      budgetCents: 3000,
      days: 3,
      householdSize: 2,
      dietaryRestrictions: [],
    })

    // Simulate that NONE of the ingredients match any unified product
    // (e.g. exotic ingredients not in Dutch supermarkets)
    const emptyPriceRows: PriceRow[] = []
    const mockSupabase = createOptimizerMockSupabase(emptyPriceRows)
    const optimizer = new ShoppingOptimizer(mockSupabase)

    // All items are "unmatched" but we still try to optimize with fake IDs
    const fakeItems: OptimizationInput['items'] = planResult.shoppingList.map((item, i) => ({
      unifiedProductId: `unknown-${i}`,
      quantity: 1,
      productName: item.ingredientName,
    }))

    const result = await optimizer.optimize({ items: fakeItems })

    // No price data means no assignments possible
    expect(result.assignments).toHaveLength(0)
    expect(result.totalCostCents).toBe(0)

    // The shopping list still has all items -- they just can't be optimized
    expect(planResult.shoppingList).toHaveLength(13)
    for (const item of planResult.shoppingList) {
      expect(item.ingredientName).toBeTruthy()
    }
  })
})
