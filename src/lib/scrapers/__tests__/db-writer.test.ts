import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScraperDbWriter } from '../db-writer'
import type { SupabaseClient, SupabaseQueryBuilder } from '../db-writer'
import type { ScrapeResult, ScrapedProduct, WriteResult } from '../types'

/**
 * Helper to create a mock Supabase query builder chain.
 * Each method returns `this` to allow chaining, except terminal methods.
 */
function createMockQueryBuilder(overrides?: {
  singleResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
  thenError?: { message: string } | null
}): SupabaseQueryBuilder {
  const builder: SupabaseQueryBuilder = {
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      overrides?.singleResult ?? { data: { id: 'product-1' }, error: null }
    ),
    then: undefined as unknown as Promise<unknown>['then'],
  }

  // Make the builder itself thenable (for awaiting insert/update without .single())
  const thenResult = { data: null, error: overrides?.thenError ?? null }
  ;(builder as Record<string, unknown>).then = (
    resolve: (val: unknown) => void,
    reject?: (err: unknown) => void
  ) => {
    return Promise.resolve(thenResult).then(resolve, reject)
  }

  return builder
}

function createMockSupabase(builderByTable?: Record<string, SupabaseQueryBuilder>): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (builderByTable && builderByTable[table]) {
        return builderByTable[table]
      }
      return createMockQueryBuilder()
    }),
  }
}

function makeProduct(overrides?: Partial<ScrapedProduct>): ScrapedProduct {
  return {
    name: 'Halfvolle Melk',
    brand: 'AH',
    ean: '8710400005568',
    priceCents: 129,
    pricePerUnitCents: 129,
    unitSize: '1L',
    unitType: 'L',
    imageUrl: 'https://example.com/melk.jpg',
    categoryRaw: 'Zuivel',
    sourceUrl: 'https://ah.nl/product/melk',
    isOnSale: false,
    originalPriceCents: null,
    nutrition: null,
    ...overrides,
  }
}

function makeScrapeResult(products: ScrapedProduct[]): ScrapeResult {
  return {
    storeSlug: 'ah',
    products,
    errors: [],
    durationMs: 1500,
    scrapedAt: new Date('2026-04-04T12:00:00Z'),
  }
}

describe('ScraperDbWriter', () => {
  let supabase: SupabaseClient
  let writer: ScraperDbWriter

  beforeEach(() => {
    supabase = createMockSupabase()
    writer = new ScraperDbWriter(supabase)
  })

  // ---------------------------------------------------------------------------
  // writeResults
  // ---------------------------------------------------------------------------
  describe('writeResults', () => {
    it('writes 3 products: upserts each product, updates old prices, inserts new prices', async () => {
      const products = [
        makeProduct({ name: 'Melk', sourceUrl: 'https://ah.nl/1' }),
        makeProduct({ name: 'Brood', sourceUrl: 'https://ah.nl/2' }),
        makeProduct({ name: 'Kaas', sourceUrl: 'https://ah.nl/3' }),
      ]
      const result = makeScrapeResult(products)

      const writeResult = await writer.writeResults(result)

      expect(writeResult.inserted).toBe(3)
      expect(writeResult.errors).toBe(0)

      // Verify supabase.from was called for products, prices tables
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls
      const tables = fromCalls.map((c: string[]) => c[0])

      // For each product: from('products'), from('prices') x2 (update old + insert new)
      expect(tables.filter((t: string) => t === 'products')).toHaveLength(3)
      expect(tables.filter((t: string) => t === 'prices')).toHaveLength(6) // 3 updates + 3 inserts
    })

    it('upserts nutrition data when product has nutrition info', async () => {
      const product = makeProduct({
        nutrition: {
          caloriesPer100g: 47,
          proteinG: 3.4,
          carbsG: 4.7,
          fatG: 1.5,
          fiberG: 0,
          saltG: 0.1,
        },
      })
      const result = makeScrapeResult([product])

      await writer.writeResults(result)

      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls
      const tables = fromCalls.map((c: string[]) => c[0])

      expect(tables).toContain('nutrition')
    })

    it('returns zeros for empty products array', async () => {
      const result = makeScrapeResult([])

      const writeResult = await writer.writeResults(result)

      expect(writeResult).toEqual({ inserted: 0, updated: 0, errors: 0 })
      // Should not call supabase at all
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('continues with other products when one upsert fails, reports error count', async () => {
      let callCount = 0
      const failingBuilder = createMockQueryBuilder()
      const successBuilder = createMockQueryBuilder()

      // Override from() to return failing builder for first product
      supabase = {
        from: vi.fn((table: string) => {
          if (table === 'products') {
            callCount++
            if (callCount === 1) {
              // First product upsert fails
              return createMockQueryBuilder({
                singleResult: { data: null, error: { message: 'unique constraint violation' } },
              })
            }
            return successBuilder
          }
          return createMockQueryBuilder()
        }),
      }
      writer = new ScraperDbWriter(supabase)

      const products = [
        makeProduct({ name: 'Failing Product', sourceUrl: 'https://ah.nl/fail' }),
        makeProduct({ name: 'Success 1', sourceUrl: 'https://ah.nl/ok1' }),
        makeProduct({ name: 'Success 2', sourceUrl: 'https://ah.nl/ok2' }),
      ]
      const result = makeScrapeResult(products)

      const writeResult = await writer.writeResults(result)

      expect(writeResult.errors).toBe(1)
      expect(writeResult.inserted).toBe(2)
    })

    it('does not upsert nutrition when product has no nutrition data', async () => {
      const product = makeProduct({ nutrition: null })
      const result = makeScrapeResult([product])

      await writer.writeResults(result)

      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls
      const tables = fromCalls.map((c: string[]) => c[0])

      expect(tables).not.toContain('nutrition')
    })
  })

  // ---------------------------------------------------------------------------
  // logScrapeRun
  // ---------------------------------------------------------------------------
  describe('logScrapeRun', () => {
    it('inserts a correct row into scrape_logs', async () => {
      const scrapeResult: ScrapeResult & { writeResult: WriteResult } = {
        storeSlug: 'ah',
        products: [makeProduct()],
        errors: [],
        durationMs: 2500,
        scrapedAt: new Date('2026-04-04T12:00:00Z'),
        writeResult: { inserted: 1, updated: 0, errors: 0 },
      }

      await writer.logScrapeRun(scrapeResult)

      expect(supabase.from).toHaveBeenCalledWith('scrape_logs')

      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls
      const logCall = fromCalls.find((c: string[]) => c[0] === 'scrape_logs')
      expect(logCall).toBeDefined()

      // Verify the builder's insert was called
      const logBuilder = (supabase.from as ReturnType<typeof vi.fn>).mock.results.find(
        (_: unknown, i: number) => fromCalls[i][0] === 'scrape_logs'
      )
      const insertFn = logBuilder?.value?.insert as ReturnType<typeof vi.fn> | undefined
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          store_slug: 'ah',
          duration_ms: 2500,
          products_scraped: 1,
          errors_count: 0,
          write_inserted: 1,
          write_errors: 0,
          status: 'success',
        })
      )
    })

    it('logs status as "partial" when there are scrape errors', async () => {
      const scrapeResult: ScrapeResult & { writeResult: WriteResult } = {
        storeSlug: 'jumbo',
        products: [makeProduct()],
        errors: [{ url: 'https://jumbo.nl/fail', message: 'timeout', phase: 'fetch' }],
        durationMs: 5000,
        scrapedAt: new Date('2026-04-04T12:00:00Z'),
        writeResult: { inserted: 1, updated: 0, errors: 0 },
      }

      await writer.logScrapeRun(scrapeResult)

      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls
      const logBuilder = (supabase.from as ReturnType<typeof vi.fn>).mock.results.find(
        (_: unknown, i: number) => fromCalls[i][0] === 'scrape_logs'
      )
      const insertFn = logBuilder?.value?.insert as ReturnType<typeof vi.fn> | undefined
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'partial',
          errors_count: 1,
        })
      )
    })
  })
})
