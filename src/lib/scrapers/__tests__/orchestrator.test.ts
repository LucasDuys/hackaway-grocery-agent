import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient, SupabaseQueryBuilder } from '../db-writer'
import type { ScrapeResult, ScrapedProduct } from '../types'

// ---------------------------------------------------------------------------
// Mock all 6 scrapers + db-writer before importing orchestrator
// ---------------------------------------------------------------------------

const mockScrape = vi.fn<() => Promise<ScrapeResult>>()

vi.mock('../ah-scraper', () => ({
  AhScraper: vi.fn().mockImplementation(() => ({ scrape: mockScrape, storeSlug: 'ah', storeName: 'Albert Heijn' })),
}))
vi.mock('../jumbo-scraper', () => ({
  JumboScraper: vi.fn().mockImplementation(() => ({ scrape: mockScrape, storeSlug: 'jumbo', storeName: 'Jumbo' })),
}))
vi.mock('../lidl-scraper', () => ({
  LidlScraper: vi.fn().mockImplementation(() => ({ scrape: mockScrape, storeSlug: 'lidl', storeName: 'Lidl' })),
}))
vi.mock('../picnic-scraper', () => ({
  PicnicScraper: vi.fn().mockImplementation(() => ({ scrape: mockScrape, storeSlug: 'picnic', storeName: 'Picnic' })),
}))
vi.mock('../plus-scraper', () => ({
  PlusScraper: vi.fn().mockImplementation(() => ({ scrape: mockScrape, storeSlug: 'plus', storeName: 'Plus' })),
}))
vi.mock('../aldi-scraper', () => ({
  AldiScraper: vi.fn().mockImplementation(() => ({ scrape: mockScrape, storeSlug: 'aldi', storeName: 'Aldi' })),
}))

const mockWriteResults = vi.fn()
const mockLogScrapeRun = vi.fn()

vi.mock('../db-writer', () => ({
  ScraperDbWriter: vi.fn().mockImplementation(() => ({
    writeResults: mockWriteResults,
    logScrapeRun: mockLogScrapeRun,
  })),
}))

import { ScraperOrchestrator } from '../orchestrator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeScrapeResult(productCount: number, storeSlug = 'ah'): ScrapeResult {
  const products = Array.from({ length: productCount }, (_, i) =>
    makeProduct({ name: `Product ${i}`, sourceUrl: `https://store.nl/${i}` })
  )
  return {
    storeSlug: storeSlug as ScrapeResult['storeSlug'],
    products,
    errors: [],
    durationMs: 1000,
    scrapedAt: new Date('2026-04-04T12:00:00Z'),
  }
}

function createMockQueryBuilder(): SupabaseQueryBuilder {
  const builder: SupabaseQueryBuilder = {
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'product-1' }, error: null }),
    then: undefined as unknown as Promise<unknown>['then'],
  }
  const thenResult = { data: null, error: null }
  ;(builder as Record<string, unknown>).then = (
    resolve: (val: unknown) => void,
    reject?: (err: unknown) => void,
  ) => Promise.resolve(thenResult).then(resolve, reject)
  return builder
}

function createMockSupabase(): SupabaseClient {
  return {
    from: vi.fn(() => createMockQueryBuilder()),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScraperOrchestrator', () => {
  let supabase: SupabaseClient
  let orchestrator: ScraperOrchestrator

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = createMockSupabase()
    orchestrator = new ScraperOrchestrator(supabase)

    // Default: each scraper returns 5 products, no errors
    mockScrape.mockResolvedValue(makeScrapeResult(5))
    mockWriteResults.mockResolvedValue({ inserted: 5, updated: 0, errors: 0 })
    mockLogScrapeRun.mockResolvedValue(undefined)
  })

  describe('runAll', () => {
    it('runs all 6 scrapers sequentially', async () => {
      const result = await orchestrator.runAll()

      // scrape() called 6 times (once per store)
      expect(mockScrape).toHaveBeenCalledTimes(6)
      expect(result.storeResults).toHaveLength(6)
    })

    it('returns correct total product count across all stores', async () => {
      mockScrape.mockResolvedValue(makeScrapeResult(10))
      mockWriteResults.mockResolvedValue({ inserted: 10, updated: 0, errors: 0 })

      const result = await orchestrator.runAll()

      expect(result.totalProducts).toBe(60) // 6 stores x 10 products
    })

    it('returns correct total error count across all stores', async () => {
      mockScrape.mockResolvedValue({
        ...makeScrapeResult(3),
        errors: [{ url: 'https://store.nl/fail', message: 'timeout', phase: 'fetch' as const }],
      })
      mockWriteResults.mockResolvedValue({ inserted: 3, updated: 0, errors: 1 })

      const result = await orchestrator.runAll()

      // Each store: 1 scrape error + 1 write error = 2 errors x 6 stores = 12
      expect(result.totalErrors).toBe(12)
    })

    it('reports overall duration in milliseconds', async () => {
      const result = await orchestrator.runAll()

      expect(typeof result.durationMs).toBe('number')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('one scraper failing does not stop others', () => {
    it('continues running remaining scrapers when one throws', async () => {
      let callCount = 0
      mockScrape.mockImplementation(async () => {
        callCount++
        if (callCount === 3) {
          throw new Error('Network timeout on store 3')
        }
        return makeScrapeResult(5)
      })

      const result = await orchestrator.runAll()

      // All 6 scrapers were attempted
      expect(mockScrape).toHaveBeenCalledTimes(6)
      expect(result.storeResults).toHaveLength(6)

      // The failed store has status 'failed'
      const failedStores = result.storeResults.filter((r) => r.status === 'failed')
      expect(failedStores).toHaveLength(1)

      // The other 5 completed
      const completedStores = result.storeResults.filter((r) => r.status === 'completed')
      expect(completedStores).toHaveLength(5)
    })

    it('marks failed store with 0 products and error count 1', async () => {
      let callCount = 0
      mockScrape.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('Crash')
        }
        return makeScrapeResult(5)
      })

      const result = await orchestrator.runAll()

      const failedStore = result.storeResults.find((r) => r.status === 'failed')
      expect(failedStore).toBeDefined()
      expect(failedStore!.productsScraped).toBe(0)
      expect(failedStore!.errorsCount).toBe(1)
    })
  })

  describe('writes results to DB for each scraper', () => {
    it('calls writeResults for each successful scraper', async () => {
      await orchestrator.runAll()

      // writeResults called once per successful scraper (all 6 succeed)
      expect(mockWriteResults).toHaveBeenCalledTimes(6)
    })

    it('does not call writeResults for a failed scraper', async () => {
      let callCount = 0
      mockScrape.mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          throw new Error('Crash')
        }
        return makeScrapeResult(5)
      })

      await orchestrator.runAll()

      // Only 5 successful scrapers write results
      expect(mockWriteResults).toHaveBeenCalledTimes(5)
    })
  })

  describe('logs scrape run to scrape_logs', () => {
    it('calls logScrapeRun for each successful scraper', async () => {
      await orchestrator.runAll()

      expect(mockLogScrapeRun).toHaveBeenCalledTimes(6)
    })

    it('does not log for a failed scraper', async () => {
      let callCount = 0
      mockScrape.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('Crash')
        }
        return makeScrapeResult(5)
      })

      await orchestrator.runAll()

      expect(mockLogScrapeRun).toHaveBeenCalledTimes(5)
    })
  })

  describe('returns correct summary with totals', () => {
    it('each store result has storeSlug, productsScraped, errorsCount, durationMs, status', async () => {
      const result = await orchestrator.runAll()

      for (const storeResult of result.storeResults) {
        expect(storeResult).toEqual(
          expect.objectContaining({
            storeSlug: expect.any(String),
            productsScraped: expect.any(Number),
            errorsCount: expect.any(Number),
            durationMs: expect.any(Number),
            status: expect.stringMatching(/^(completed|failed)$/),
          })
        )
      }
    })

    it('totalProducts matches sum of individual store products', async () => {
      // Vary product counts per call
      let callCount = 0
      mockScrape.mockImplementation(async () => {
        callCount++
        return makeScrapeResult(callCount * 2) // 2, 4, 6, 8, 10, 12
      })
      mockWriteResults.mockResolvedValue({ inserted: 0, updated: 0, errors: 0 })

      const result = await orchestrator.runAll()

      const sumFromStores = result.storeResults.reduce((s, r) => s + r.productsScraped, 0)
      expect(result.totalProducts).toBe(sumFromStores)
      expect(result.totalProducts).toBe(2 + 4 + 6 + 8 + 10 + 12)
    })
  })

  describe('runStore', () => {
    it('runs only the specified store scraper', async () => {
      const result = await orchestrator.runStore('ah')

      expect(mockScrape).toHaveBeenCalledTimes(1)
      expect(result.storeResults).toHaveLength(1)
      expect(result.storeResults[0].status).toBe('completed')
    })
  })

  describe('runStores', () => {
    it('runs only the specified subset of scrapers', async () => {
      const result = await orchestrator.runStores(['ah', 'lidl'])

      expect(mockScrape).toHaveBeenCalledTimes(2)
      expect(result.storeResults).toHaveLength(2)
    })
  })
})
