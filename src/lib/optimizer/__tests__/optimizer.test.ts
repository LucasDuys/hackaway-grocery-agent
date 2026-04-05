import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShoppingOptimizer } from '../optimizer'
import type { SupabaseClient, SupabaseQueryBuilder } from '../../scrapers/db-writer'
import type { OptimizationInput } from '../types'

// ---------------------------------------------------------------------------
// Test fixtures: 5 products across 3 stores (AH, Jumbo, Lidl)
// ---------------------------------------------------------------------------

// Prices in cents:
//                    AH     Jumbo   Lidl
// Milk (1L)         119     109     99
// Bread             239     249     229
// Cheese            499     479     --  (missing at Lidl)
// Eggs              329     349     319
// Butter            279     269     289

const STORE_AH = { slug: 'ah', name: 'Albert Heijn' }
const STORE_JUMBO = { slug: 'jumbo', name: 'Jumbo' }
const STORE_LIDL = { slug: 'lidl', name: 'Lidl' }

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

function makePriceRows(): PriceRow[] {
  return [
    // Milk
    { unified_product_id: 'u-milk', product_id: 'p-ah-milk', products: { id: 'p-ah-milk', name: 'Melk 1L', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 119 }] },
    { unified_product_id: 'u-milk', product_id: 'p-jumbo-milk', products: { id: 'p-jumbo-milk', name: 'Melk 1L', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 109 }] },
    { unified_product_id: 'u-milk', product_id: 'p-lidl-milk', products: { id: 'p-lidl-milk', name: 'Melk 1L', store_id: 's-lidl', stores: STORE_LIDL }, prices: [{ price_cents: 99 }] },
    // Bread
    { unified_product_id: 'u-bread', product_id: 'p-ah-bread', products: { id: 'p-ah-bread', name: 'Brood', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 239 }] },
    { unified_product_id: 'u-bread', product_id: 'p-jumbo-bread', products: { id: 'p-jumbo-bread', name: 'Brood', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 249 }] },
    { unified_product_id: 'u-bread', product_id: 'p-lidl-bread', products: { id: 'p-lidl-bread', name: 'Brood', store_id: 's-lidl', stores: STORE_LIDL }, prices: [{ price_cents: 229 }] },
    // Cheese (missing at Lidl)
    { unified_product_id: 'u-cheese', product_id: 'p-ah-cheese', products: { id: 'p-ah-cheese', name: 'Kaas', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 499 }] },
    { unified_product_id: 'u-cheese', product_id: 'p-jumbo-cheese', products: { id: 'p-jumbo-cheese', name: 'Kaas', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 479 }] },
    // Eggs
    { unified_product_id: 'u-eggs', product_id: 'p-ah-eggs', products: { id: 'p-ah-eggs', name: 'Eieren', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 329 }] },
    { unified_product_id: 'u-eggs', product_id: 'p-jumbo-eggs', products: { id: 'p-jumbo-eggs', name: 'Eieren', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 349 }] },
    { unified_product_id: 'u-eggs', product_id: 'p-lidl-eggs', products: { id: 'p-lidl-eggs', name: 'Eieren', store_id: 's-lidl', stores: STORE_LIDL }, prices: [{ price_cents: 319 }] },
    // Butter
    { unified_product_id: 'u-butter', product_id: 'p-ah-butter', products: { id: 'p-ah-butter', name: 'Boter', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 279 }] },
    { unified_product_id: 'u-butter', product_id: 'p-jumbo-butter', products: { id: 'p-jumbo-butter', name: 'Boter', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 269 }] },
    { unified_product_id: 'u-butter', product_id: 'p-lidl-butter', products: { id: 'p-lidl-butter', name: 'Boter', store_id: 's-lidl', stores: STORE_LIDL }, prices: [{ price_cents: 289 }] },
  ]
}

const ALL_ITEMS: OptimizationInput['items'] = [
  { unifiedProductId: 'u-milk', quantity: 1, productName: 'Milk' },
  { unifiedProductId: 'u-bread', quantity: 1, productName: 'Bread' },
  { unifiedProductId: 'u-cheese', quantity: 1, productName: 'Cheese' },
  { unifiedProductId: 'u-eggs', quantity: 1, productName: 'Eggs' },
  { unifiedProductId: 'u-butter', quantity: 1, productName: 'Butter' },
]

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockSupabase(
  priceRows: PriceRow[] = makePriceRows(),
  storeLocations?: Array<{
    store_id: string
    latitude: number
    longitude: number
    stores: { slug: string }
  }>,
): SupabaseClient {
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
      } else if (table === 'store_locations') {
        builder.select = vi.fn().mockReturnValue({
          then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
            Promise.resolve({ data: storeLocations ?? [], error: null }).then(resolve, reject),
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

describe('ShoppingOptimizer', () => {
  let optimizer: ShoppingOptimizer

  beforeEach(() => {
    optimizer = new ShoppingOptimizer(createMockSupabase())
  })

  // =========================================================================
  // No constraints: picks cheapest per item
  // =========================================================================
  describe('no constraints', () => {
    it('picks the cheapest store per item and calculates correct total', async () => {
      const result = await optimizer.optimize({ items: ALL_ITEMS })

      // Cheapest per item:
      // Milk: Lidl 99, Bread: Lidl 229, Cheese: Jumbo 479, Eggs: Lidl 319, Butter: Jumbo 269
      // Total = 99 + 229 + 479 + 319 + 269 = 1395
      expect(result.totalCostCents).toBe(1395)
      expect(result.assignments).toHaveLength(5)

      const milkAssign = result.assignments.find((a) => a.unifiedProductId === 'u-milk')
      expect(milkAssign?.storeSlug).toBe('lidl')
      expect(milkAssign?.priceCents).toBe(99)

      const cheeseAssign = result.assignments.find((a) => a.unifiedProductId === 'u-cheese')
      expect(cheeseAssign?.storeSlug).toBe('jumbo')
      expect(cheeseAssign?.priceCents).toBe(479)

      const butterAssign = result.assignments.find((a) => a.unifiedProductId === 'u-butter')
      expect(butterAssign?.storeSlug).toBe('jumbo')
      expect(butterAssign?.priceCents).toBe(269)
    })
  })

  // =========================================================================
  // Store subset constraint
  // =========================================================================
  describe('store subset constraint', () => {
    it('only considers selected stores', async () => {
      const result = await optimizer.optimize({
        items: ALL_ITEMS,
        constraints: { storeSlugs: ['ah', 'jumbo'] },
      })

      // Without Lidl:
      // Milk: Jumbo 109, Bread: AH 239, Cheese: Jumbo 479, Eggs: AH 329, Butter: Jumbo 269
      // Total = 109 + 239 + 479 + 329 + 269 = 1425
      expect(result.totalCostCents).toBe(1425)

      for (const a of result.assignments) {
        expect(['ah', 'jumbo']).toContain(a.storeSlug)
      }
    })
  })

  // =========================================================================
  // Max 2 stores constraint
  // =========================================================================
  describe('max stores constraint', () => {
    it('merges to max 2 stores with higher but constrained total', async () => {
      const result = await optimizer.optimize({
        items: ALL_ITEMS,
        constraints: { maxStores: 2 },
      })

      const uniqueStores = new Set(result.assignments.map((a) => a.storeSlug))
      expect(uniqueStores.size).toBeLessThanOrEqual(2)
      // Must be at least as expensive as unconstrained
      expect(result.totalCostCents).toBeGreaterThanOrEqual(1395)
    })

    it('max 1 store is equivalent to cheapest single store', async () => {
      const result = await optimizer.optimize({
        items: ALL_ITEMS,
        constraints: { maxStores: 1 },
      })

      const uniqueStores = new Set(result.assignments.map((a) => a.storeSlug))
      expect(uniqueStores.size).toBe(1)

      // Only AH and Jumbo have all 5 items (cheese missing at Lidl)
      // AH total: 119+239+499+329+279 = 1465
      // Jumbo total: 109+249+479+349+269 = 1455
      // Jumbo is cheaper single store with all items
      // But since cheese is missing at Lidl, Lidl can't be the single store
      const store = [...uniqueStores][0]
      expect(['ah', 'jumbo']).toContain(store)
    })
  })

  // =========================================================================
  // Radius filter
  // =========================================================================
  describe('radius filter', () => {
    it('only considers nearby stores based on coordinates', async () => {
      // Eindhoven coordinates: 51.4416, 5.4697
      // Place AH nearby (1km), Jumbo far (100km), Lidl nearby (2km)
      const locations = [
        { store_id: 's-ah', latitude: 51.4420, longitude: 5.4700, stores: { slug: 'ah' } },
        { store_id: 's-jumbo', latitude: 52.3700, longitude: 4.8900, stores: { slug: 'jumbo' } },
        { store_id: 's-lidl', latitude: 51.4430, longitude: 5.4710, stores: { slug: 'lidl' } },
      ]

      const mockSupabase = createMockSupabase(makePriceRows(), locations)
      const opt = new ShoppingOptimizer(mockSupabase)

      const result = await opt.optimize({
        items: ALL_ITEMS,
        constraints: {
          userLat: 51.4416,
          userLng: 5.4697,
          maxRadiusKm: 5, // Only AH and Lidl within 5km
        },
      })

      // Should only have AH and Lidl assignments (Jumbo is far)
      for (const a of result.assignments) {
        expect(['ah', 'lidl']).toContain(a.storeSlug)
      }
    })
  })

  // =========================================================================
  // Missing products
  // =========================================================================
  describe('missing products', () => {
    it('assigns item only available at one store to that store', async () => {
      const result = await optimizer.optimize({
        items: [{ unifiedProductId: 'u-cheese', quantity: 2, productName: 'Cheese' }],
      })

      // Cheese only at AH (499) and Jumbo (479), not Lidl
      // Cheapest is Jumbo
      expect(result.assignments).toHaveLength(1)
      expect(result.assignments[0].storeSlug).toBe('jumbo')
      expect(result.assignments[0].priceCents).toBe(479)
      expect(result.assignments[0].quantity).toBe(2)
      expect(result.totalCostCents).toBe(958) // 479 * 2
    })
  })

  // =========================================================================
  // All same price (tie-breaking)
  // =========================================================================
  describe('tie-breaking', () => {
    it('prefers fewer stores when prices are equal', async () => {
      // All items same price at all stores
      const samePriceRows: PriceRow[] = [
        { unified_product_id: 'u-a', product_id: 'p-ah-a', products: { id: 'p-ah-a', name: 'A', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 100 }] },
        { unified_product_id: 'u-a', product_id: 'p-jumbo-a', products: { id: 'p-jumbo-a', name: 'A', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 100 }] },
        { unified_product_id: 'u-b', product_id: 'p-ah-b', products: { id: 'p-ah-b', name: 'B', store_id: 's-ah', stores: STORE_AH }, prices: [{ price_cents: 200 }] },
        { unified_product_id: 'u-b', product_id: 'p-jumbo-b', products: { id: 'p-jumbo-b', name: 'B', store_id: 's-jumbo', stores: STORE_JUMBO }, prices: [{ price_cents: 200 }] },
      ]

      const opt = new ShoppingOptimizer(createMockSupabase(samePriceRows))
      const result = await opt.optimize({
        items: [
          { unifiedProductId: 'u-a', quantity: 1, productName: 'A' },
          { unifiedProductId: 'u-b', quantity: 1, productName: 'B' },
        ],
      })

      // With alphabetical tie-breaking on slug, both should go to 'ah'
      const uniqueStores = new Set(result.assignments.map((a) => a.storeSlug))
      expect(uniqueStores.size).toBe(1)
      expect(result.totalCostCents).toBe(300)
    })
  })

  // =========================================================================
  // Empty list
  // =========================================================================
  describe('empty list', () => {
    it('returns zero totals for empty item list', async () => {
      const result = await optimizer.optimize({ items: [] })

      expect(result.assignments).toHaveLength(0)
      expect(result.totalCostCents).toBe(0)
      expect(result.storeBreakdown).toHaveLength(0)
      expect(result.singleStoreComparisons).toHaveLength(0)
      expect(result.savingsCents).toBe(0)
    })
  })

  // =========================================================================
  // Single item
  // =========================================================================
  describe('single item', () => {
    it('handles a single item correctly', async () => {
      const result = await optimizer.optimize({
        items: [{ unifiedProductId: 'u-milk', quantity: 3, productName: 'Milk' }],
      })

      expect(result.assignments).toHaveLength(1)
      expect(result.assignments[0].storeSlug).toBe('lidl')
      expect(result.assignments[0].priceCents).toBe(99)
      expect(result.assignments[0].quantity).toBe(3)
      expect(result.totalCostCents).toBe(297) // 99 * 3
    })
  })

  // =========================================================================
  // Savings calculation
  // =========================================================================
  describe('savings calculation', () => {
    it('savings equals cheapest single store minus optimized total', async () => {
      const result = await optimizer.optimize({ items: ALL_ITEMS })

      // Cheapest single store with all items:
      // AH: 119+239+499+329+279 = 1465
      // Jumbo: 109+249+479+349+269 = 1455
      // Lidl: missing cheese, so not a full store
      // Cheapest full store = Jumbo at 1455
      // Optimized = 1395
      // Savings = 1455 - 1395 = 60
      expect(result.savingsCents).toBe(60)
      expect(result.savingsCents).toBeGreaterThan(0)
    })

    it('savings is zero when max 1 store', async () => {
      const result = await optimizer.optimize({
        items: ALL_ITEMS,
        constraints: { maxStores: 1 },
      })

      // When constrained to 1 store, total equals cheapest single store
      expect(result.savingsCents).toBe(0)
    })
  })

  // =========================================================================
  // Store breakdown
  // =========================================================================
  describe('store breakdown', () => {
    it('has correct itemCount and subtotals per store', async () => {
      const result = await optimizer.optimize({ items: ALL_ITEMS })

      // Unconstrained cheapest:
      // Lidl: Milk(99), Bread(229), Eggs(319) = 3 items, 647 cents
      // Jumbo: Cheese(479), Butter(269) = 2 items, 748 cents
      const lidlBreakdown = result.storeBreakdown.find((s) => s.storeSlug === 'lidl')
      expect(lidlBreakdown).toBeDefined()
      expect(lidlBreakdown!.itemCount).toBe(3)
      expect(lidlBreakdown!.subtotalCents).toBe(647)

      const jumboBreakdown = result.storeBreakdown.find((s) => s.storeSlug === 'jumbo')
      expect(jumboBreakdown).toBeDefined()
      expect(jumboBreakdown!.itemCount).toBe(2)
      expect(jumboBreakdown!.subtotalCents).toBe(748)

      // Total of breakdowns should match totalCostCents
      const breakdownTotal = result.storeBreakdown.reduce((s, b) => s + b.subtotalCents, 0)
      expect(breakdownTotal).toBe(result.totalCostCents)
    })
  })

  // =========================================================================
  // Single store comparisons
  // =========================================================================
  describe('single store comparisons', () => {
    it('correctly counts missing items per store', async () => {
      const result = await optimizer.optimize({ items: ALL_ITEMS })

      const lidlComp = result.singleStoreComparisons.find((c) => c.storeSlug === 'lidl')
      expect(lidlComp).toBeDefined()
      expect(lidlComp!.missingItems).toBe(1) // Cheese missing
      expect(lidlComp!.availableItems).toBe(4)

      const ahComp = result.singleStoreComparisons.find((c) => c.storeSlug === 'ah')
      expect(ahComp).toBeDefined()
      expect(ahComp!.missingItems).toBe(0)
      expect(ahComp!.availableItems).toBe(5)
      // AH total: 119+239+499+329+279 = 1465
      expect(ahComp!.totalCents).toBe(1465)
    })
  })

  // =========================================================================
  // Quantity handling
  // =========================================================================
  describe('quantity handling', () => {
    it('multiplies price by quantity in totals', async () => {
      const result = await optimizer.optimize({
        items: [
          { unifiedProductId: 'u-milk', quantity: 5, productName: 'Milk' },
        ],
      })

      expect(result.totalCostCents).toBe(495) // 99 * 5 at Lidl
    })
  })
})
