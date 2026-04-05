import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScraperDbWriter } from '@/lib/scrapers/db-writer'
import type { SupabaseClient, SupabaseQueryBuilder } from '@/lib/scrapers/db-writer'
import type { ScrapeResult, ScrapedProduct } from '@/lib/scrapers/types'
import { EanMatcher } from '@/lib/matching/ean-matcher'
import { ShoppingOptimizer } from '@/lib/optimizer/optimizer'
import type { OptimizationInput } from '@/lib/optimizer/types'

// ---------------------------------------------------------------------------
// In-memory data store
// ---------------------------------------------------------------------------

interface StoredProduct {
  id: string
  store_slug: string
  store_id: string
  name: string
  ean: string | null
  category: string | null
  is_active: boolean
  source_url: string
}

interface StoredPrice {
  product_id: string
  price_cents: number
  is_current: boolean
}

interface StoredUnifiedProduct {
  id: string
  canonical_name: string
  canonical_category: string | null
  ean: string | null
}

interface StoredMapping {
  unified_product_id: string
  product_id: string
  confidence_score: number
  match_method: string
}

interface StoredStore {
  id: string
  slug: string
  name: string
}

// ---------------------------------------------------------------------------
// Mock OpenFoodFacts
// ---------------------------------------------------------------------------

vi.mock('@/lib/matching/openfoodfacts', () => ({
  OpenFoodFactsClient: vi.fn().mockImplementation(() => ({
    lookupByEan: vi.fn().mockResolvedValue(null),
  })),
}))

// ---------------------------------------------------------------------------
// In-memory Supabase mock
// ---------------------------------------------------------------------------

function createInMemorySupabase() {
  const products: StoredProduct[] = []
  const prices: StoredPrice[] = []
  const unifiedProducts: StoredUnifiedProduct[] = []
  const mappings: StoredMapping[] = []

  const stores: StoredStore[] = [
    { id: 'store-ah', slug: 'ah', name: 'Albert Heijn' },
    { id: 'store-jumbo', slug: 'jumbo', name: 'Jumbo' },
  ]

  let idCounter = 0
  const nextId = () => `id-${++idCounter}`

  function getStoreIdBySlug(slug: string): string {
    return stores.find((s) => s.slug === slug)?.id ?? slug
  }

  /**
   * Build a chainable mock builder that tracks pending operation state
   * through the entire method chain. Uses a shared context object so
   * .eq() calls accumulate filters even across new builder references.
   */
  function makeChainableBuilder(
    table: string,
    ctx: {
      op: 'upsert' | 'insert' | 'update' | 'select' | 'none'
      data: Record<string, unknown> | null
      options: { onConflict?: string } | null
      filters: Record<string, unknown>
    },
  ): Record<string, unknown> {
    const self: Record<string, unknown> = {}

    self.upsert = vi.fn((data: Record<string, unknown>, options?: { onConflict?: string }) => {
      ctx.op = 'upsert'
      ctx.data = data
      ctx.options = options ?? null
      return self
    })

    self.insert = vi.fn((data: Record<string, unknown>) => {
      ctx.op = 'insert'
      ctx.data = data
      return self
    })

    self.update = vi.fn((data: Record<string, unknown>) => {
      ctx.op = 'update'
      ctx.data = data
      return self
    })

    self.eq = vi.fn((col: string, val: unknown) => {
      ctx.filters[col] = val

      // Execute update-with-filters eagerly when we have 2+ filters on prices
      // (ScraperDbWriter chains .update({is_current:false}).eq('product_id',x).eq('is_current',true))
      if (ctx.op === 'update' && table === 'prices' && Object.keys(ctx.filters).length >= 2) {
        for (const p of prices) {
          let match = true
          for (const [k, v] of Object.entries(ctx.filters)) {
            if ((p as Record<string, unknown>)[k] !== v) match = false
          }
          if (match && ctx.data) {
            Object.assign(p, ctx.data)
          }
        }
      }

      return self
    })

    self.select = vi.fn((_columns?: string) => {
      // product_mappings read query (for optimizer)
      if (table === 'product_mappings' && ctx.op === 'none') {
        const readSelf: Record<string, unknown> = {}
        readSelf.eq = vi.fn((_col: string, _val: unknown) => ({
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            const data = buildMappingJoinData()
            return Promise.resolve({ data, error: null }).then(resolve, reject)
          },
        }))
        return readSelf
      }

      // products read query (for EAN matcher)
      if (table === 'products' && ctx.op === 'none') {
        const readSelf: Record<string, unknown> = {}
        readSelf.eq = vi.fn((_col: string, _val: unknown) => ({
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            const data = products.filter((p) => p.is_active).map((p) => ({
              id: p.id,
              store_id: p.store_id,
              name: p.name,
              ean: p.ean,
              category: p.category,
            }))
            return Promise.resolve({ data, error: null }).then(resolve, reject)
          },
        }))
        return readSelf
      }

      // After write ops: select returns a builder with .single()
      return self
    })

    self.single = vi.fn(() => {
      if ((ctx.op === 'upsert' || ctx.op === 'insert') && ctx.data) {
        const id = executeWrite(table, ctx)
        return Promise.resolve({ data: { id }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // Thenable: makes the builder await-able (for operations without .single())
    self.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if ((ctx.op === 'insert' || ctx.op === 'upsert') && ctx.data) {
        executeWrite(table, ctx)
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject)
    }

    return self
  }

  function executeWrite(
    table: string,
    ctx: { op: string; data: Record<string, unknown> | null; options: { onConflict?: string } | null; filters: Record<string, unknown> },
  ): string {
    const data = ctx.data!

    if (table === 'products') {
      const slug = data.store_slug as string
      const sourceUrl = data.source_url as string
      const existing = products.find((p) => p.store_slug === slug && p.source_url === sourceUrl)
      if (existing) {
        Object.assign(existing, { name: data.name, ean: data.ean ?? existing.ean })
        return existing.id
      }
      const id = nextId()
      products.push({
        id,
        store_slug: slug,
        store_id: getStoreIdBySlug(slug),
        name: data.name as string,
        ean: (data.ean as string) ?? null,
        category: (data.category_raw as string) ?? null,
        is_active: true,
        source_url: sourceUrl,
      })
      return id
    }

    if (table === 'prices') {
      prices.push({
        product_id: data.product_id as string,
        price_cents: data.price_cents as number,
        is_current: (data.is_current as boolean) ?? true,
      })
      return ''
    }

    if (table === 'unified_products') {
      const ean = (data.ean as string) ?? null
      if (ean && ctx.op === 'upsert') {
        const existing = unifiedProducts.find((u) => u.ean === ean)
        if (existing) {
          existing.canonical_name = data.canonical_name as string
          return existing.id
        }
      }
      const id = nextId()
      unifiedProducts.push({
        id,
        canonical_name: data.canonical_name as string,
        canonical_category: (data.canonical_category as string) ?? null,
        ean,
      })
      return id
    }

    if (table === 'product_mappings') {
      const existing = mappings.find(
        (m) => m.unified_product_id === data.unified_product_id && m.product_id === data.product_id,
      )
      if (!existing) {
        mappings.push({
          unified_product_id: data.unified_product_id as string,
          product_id: data.product_id as string,
          confidence_score: data.confidence_score as number,
          match_method: data.match_method as string,
        })
      }
      return ''
    }

    // scrape_logs, nutrition -- just swallow
    return ''
  }

  function buildMappingJoinData() {
    return mappings.map((m) => {
      const product = products.find((p) => p.id === m.product_id)
      if (!product) return null
      const store = stores.find((s) => s.id === product.store_id)
      const currentPrices = prices.filter((p) => p.product_id === product.id && p.is_current)
      return {
        unified_product_id: m.unified_product_id,
        product_id: m.product_id,
        products: {
          id: product.id,
          name: product.name,
          store_id: product.store_id,
          stores: store ? { slug: store.slug, name: store.name } : null,
        },
        prices: currentPrices.map((p) => ({ price_cents: p.price_cents })),
      }
    }).filter(Boolean)
  }

  const client: SupabaseClient = {
    from: vi.fn((table: string) => {
      const ctx = { op: 'none' as const, data: null, options: null, filters: {} }
      return makeChainableBuilder(table, ctx) as unknown as SupabaseQueryBuilder
    }),
  }

  return {
    client,
    getProducts: () => products,
    getPrices: () => prices,
    getUnifiedProducts: () => unifiedProducts,
    getMappings: () => mappings,
  }
}

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ScrapedProduct> & { name: string; priceCents: number }): ScrapedProduct {
  return {
    brand: null,
    ean: null,
    pricePerUnitCents: null,
    unitSize: '1',
    unitType: 'stuk',
    imageUrl: null,
    categoryRaw: null,
    sourceUrl: `https://store.nl/${overrides.name.toLowerCase().replace(/\s/g, '-')}`,
    isOnSale: false,
    originalPriceCents: null,
    nutrition: null,
    ...overrides,
  }
}

function makeAhProducts(): ScrapedProduct[] {
  return [
    makeProduct({ name: 'AH Halfvolle Melk 1L', ean: '8710400000111', priceCents: 119, unitSize: '1L', unitType: 'L' }),
    makeProduct({ name: 'AH Volkoren Brood', ean: '8710400000222', priceCents: 239, unitSize: '800g', unitType: 'g' }),
    makeProduct({ name: 'AH Jonge Kaas', ean: '8710400000333', priceCents: 499, unitSize: '500g', unitType: 'g' }),
    makeProduct({ name: 'AH Scharreleieren 10st', ean: '8710400000444', priceCents: 329, unitSize: '10', unitType: 'stuk' }),
    makeProduct({ name: 'AH Roomboter', ean: '8710400000555', priceCents: 279, unitSize: '250g', unitType: 'g' }),
  ]
}

function makeJumboProducts(): ScrapedProduct[] {
  return [
    makeProduct({ name: 'Jumbo Halfvolle Melk 1L', ean: '8710400000111', priceCents: 109, unitSize: '1L', unitType: 'L' }),
    makeProduct({ name: 'Jumbo Volkoren Brood', ean: '8710400000222', priceCents: 249, unitSize: '800g', unitType: 'g' }),
    makeProduct({ name: 'Jumbo Jonge Kaas', ean: '8710400000333', priceCents: 479, unitSize: '500g', unitType: 'g' }),
    makeProduct({ name: 'Jumbo Eieren 10 Stuks', ean: '8710400000444', priceCents: 349, unitSize: '10', unitType: 'stuk' }),
    makeProduct({ name: 'Jumbo Ongezouten Boter', ean: null, priceCents: 269, unitSize: '250g', unitType: 'g' }),
  ]
}

function makeScrapeResult(storeSlug: 'ah' | 'jumbo', prods: ScrapedProduct[]): ScrapeResult {
  return {
    storeSlug,
    products: prods,
    errors: [],
    durationMs: 1200,
    scrapedAt: new Date('2026-04-04T10:00:00Z'),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scrape to Optimize Pipeline', () => {
  let db: ReturnType<typeof createInMemorySupabase>

  beforeEach(() => {
    db = createInMemorySupabase()
  })

  it('scrapes products, matches across stores, and optimizes a shopping list', async () => {
    // Step 1: Write scrape results for AH and Jumbo
    const writer = new ScraperDbWriter(db.client)
    await writer.writeResults(makeScrapeResult('ah', makeAhProducts()))
    await writer.writeResults(makeScrapeResult('jumbo', makeJumboProducts()))

    // 10 products written (5 AH + 5 Jumbo)
    expect(db.getProducts()).toHaveLength(10)
    // 10 current prices
    expect(db.getPrices().filter((p) => p.is_current)).toHaveLength(10)

    // Step 2: EAN matcher -- 4 EANs match (milk, bread, cheese, eggs; butter has no EAN at Jumbo)
    const matcher = new EanMatcher(db.client)
    const matchResults = await matcher.match()

    const uniqueUnifiedIds = new Set(matchResults.map((r) => r.unifiedProductId))
    expect(uniqueUnifiedIds.size).toBe(4)
    expect(matchResults).toHaveLength(8) // 4 EANs * 2 stores
    expect(matchResults.every((r) => r.confidence === 1.0)).toBe(true)
    expect(matchResults.every((r) => r.matchMethod === 'exact_ean')).toBe(true)

    // Step 3: Build optimization input from 3 matched products
    const unifiedProds = db.getUnifiedProducts()
    const milkUnified = unifiedProds.find((u) => u.ean === '8710400000111')!
    const breadUnified = unifiedProds.find((u) => u.ean === '8710400000222')!
    const cheeseUnified = unifiedProds.find((u) => u.ean === '8710400000333')!

    const optimizerInput: OptimizationInput = {
      items: [
        { unifiedProductId: milkUnified.id, quantity: 2, productName: 'Halfvolle Melk' },
        { unifiedProductId: breadUnified.id, quantity: 1, productName: 'Volkoren Brood' },
        { unifiedProductId: cheeseUnified.id, quantity: 1, productName: 'Jonge Kaas' },
      ],
    }

    const optimizer = new ShoppingOptimizer(db.client)
    const result = await optimizer.optimize(optimizerInput)

    // Step 4: Verify assignments
    expect(result.assignments).toHaveLength(3)

    // Milk: AH=119, Jumbo=109 -> Jumbo
    const milkAssign = result.assignments.find((a) => a.unifiedProductId === milkUnified.id)!
    expect(milkAssign.storeSlug).toBe('jumbo')
    expect(milkAssign.priceCents).toBe(109)

    // Bread: AH=239, Jumbo=249 -> AH
    const breadAssign = result.assignments.find((a) => a.unifiedProductId === breadUnified.id)!
    expect(breadAssign.storeSlug).toBe('ah')
    expect(breadAssign.priceCents).toBe(239)

    // Cheese: AH=499, Jumbo=479 -> Jumbo
    const cheeseAssign = result.assignments.find((a) => a.unifiedProductId === cheeseUnified.id)!
    expect(cheeseAssign.storeSlug).toBe('jumbo')
    expect(cheeseAssign.priceCents).toBe(479)

    // Total: 109*2 + 239 + 479 = 936
    expect(result.totalCostCents).toBe(936)

    // Savings vs cheapest single store:
    // AH: 119*2 + 239 + 499 = 976
    // Jumbo: 109*2 + 249 + 479 = 946
    // Cheapest single = 946, optimized = 936, savings = 10
    expect(result.savingsCents).toBe(10)
  })

  it('handles products only available at one store', async () => {
    // Only AH has pindakaas
    const writer = new ScraperDbWriter(db.client)
    await writer.writeResults(makeScrapeResult('ah', [
      makeProduct({ name: 'AH Pindakaas', ean: '8710400009999', priceCents: 349, unitSize: '350g', unitType: 'g' }),
    ]))

    // EAN matcher finds no cross-store matches
    const matcher = new EanMatcher(db.client)
    const matchResults = await matcher.match()
    expect(matchResults).toHaveLength(0)

    // Manually create unified product + mapping (simulates prior match)
    const product = db.getProducts()[0]
    const unifiedId = 'manual-unified-pindakaas'
    db.getUnifiedProducts().push({
      id: unifiedId,
      canonical_name: 'Pindakaas',
      canonical_category: null,
      ean: '8710400009999',
    })
    db.getMappings().push({
      unified_product_id: unifiedId,
      product_id: product.id,
      confidence_score: 1.0,
      match_method: 'exact_ean',
    })

    const optimizer = new ShoppingOptimizer(db.client)
    const result = await optimizer.optimize({
      items: [{ unifiedProductId: unifiedId, quantity: 1, productName: 'Pindakaas' }],
    })

    // Must assign to AH since it is the only store
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].storeSlug).toBe('ah')
    expect(result.assignments[0].priceCents).toBe(349)
    expect(result.totalCostCents).toBe(349)
  })

  it('respects max stores constraint', async () => {
    const writer = new ScraperDbWriter(db.client)
    await writer.writeResults(makeScrapeResult('ah', makeAhProducts()))
    await writer.writeResults(makeScrapeResult('jumbo', makeJumboProducts()))

    const matcher = new EanMatcher(db.client)
    await matcher.match()

    const unifiedProds = db.getUnifiedProducts()
    const milkUnified = unifiedProds.find((u) => u.ean === '8710400000111')!
    const breadUnified = unifiedProds.find((u) => u.ean === '8710400000222')!
    const cheeseUnified = unifiedProds.find((u) => u.ean === '8710400000333')!
    const eggsUnified = unifiedProds.find((u) => u.ean === '8710400000444')!

    const optimizer = new ShoppingOptimizer(db.client)
    const result = await optimizer.optimize({
      items: [
        { unifiedProductId: milkUnified.id, quantity: 1, productName: 'Melk' },
        { unifiedProductId: breadUnified.id, quantity: 1, productName: 'Brood' },
        { unifiedProductId: cheeseUnified.id, quantity: 1, productName: 'Kaas' },
        { unifiedProductId: eggsUnified.id, quantity: 1, productName: 'Eieren' },
      ],
      constraints: { maxStores: 1 },
    })

    // All items from a single store
    const uniqueStores = new Set(result.assignments.map((a) => a.storeSlug))
    expect(uniqueStores.size).toBe(1)

    // AH: 119+239+499+329 = 1186, Jumbo: 109+249+479+349 = 1186 (tie)
    const chosenStore = [...uniqueStores][0]
    expect(['ah', 'jumbo']).toContain(chosenStore)
    expect(result.totalCostCents).toBe(1186)
  })
})
