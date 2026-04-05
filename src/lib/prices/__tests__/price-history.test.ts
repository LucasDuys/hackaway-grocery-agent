import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PriceHistoryService } from '../price-history'
import type { SupabaseClient, SupabaseQueryBuilder } from '../price-history'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate price history data over N weeks with a given price trajectory */
function generatePriceHistory(options: {
  weeks: number
  startPriceCents: number
  endPriceCents: number
  isOnSale?: boolean
}): { price_cents: number; scraped_at: string; is_on_sale: boolean; original_price_cents: number | null }[] {
  const { weeks, startPriceCents, endPriceCents, isOnSale = false } = options
  const points = weeks + 1 // one per week boundary
  const now = new Date('2026-04-04T12:00:00Z')
  const result: {
    price_cents: number
    scraped_at: string
    is_on_sale: boolean
    original_price_cents: number | null
  }[] = []

  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const price = Math.round(startPriceCents + (endPriceCents - startPriceCents) * t)
    const date = new Date(now.getTime() - (weeks - i) * 7 * 24 * 60 * 60 * 1000)
    result.push({
      price_cents: price,
      scraped_at: date.toISOString(),
      is_on_sale: isOnSale,
      original_price_cents: null,
    })
  }

  return result
}

/** Create a mock Supabase query builder chain */
function createMockQueryBuilder(resolvedValue: {
  data: unknown
  error: { message: string } | null
}): SupabaseQueryBuilder {
  const builder: SupabaseQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: undefined as unknown as Promise<unknown>['then'],
  }

  ;(builder as Record<string, unknown>).then = (
    resolve: (val: unknown) => void,
    reject?: (err: unknown) => void
  ) => {
    return Promise.resolve(resolvedValue).then(resolve, reject)
  }

  return builder
}

function createMockSupabase(fromHandler: (table: string) => SupabaseQueryBuilder): SupabaseClient {
  return {
    from: vi.fn(fromHandler),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PriceHistoryService', () => {
  // -----------------------------------------------------------------------
  // getHistory
  // -----------------------------------------------------------------------
  describe('getHistory', () => {
    it('returns prices sorted by date', async () => {
      const priceData = generatePriceHistory({ weeks: 4, startPriceCents: 200, endPriceCents: 250 })
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const result = await service.getHistory('product-1')

      expect(result.productId).toBe('product-1')
      expect(result.prices).toHaveLength(priceData.length)
      // Verify ascending order
      for (let i = 1; i < result.prices.length; i++) {
        expect(result.prices[i].scrapedAt.getTime()).toBeGreaterThanOrEqual(
          result.prices[i - 1].scrapedAt.getTime()
        )
      }
    })

    it('filters by days when provided', async () => {
      const priceData = generatePriceHistory({ weeks: 1, startPriceCents: 200, endPriceCents: 200 })
      let usedBuilder: SupabaseQueryBuilder | null = null
      const supabase = createMockSupabase(() => {
        const builder = createMockQueryBuilder({ data: priceData, error: null })
        usedBuilder = builder
        return builder
      })
      const service = new PriceHistoryService(supabase)

      await service.getHistory('product-1', 7)

      // Verify gte was called (date filter applied)
      expect(usedBuilder!.gte).toHaveBeenCalledWith('scraped_at', expect.any(String))
    })

    it('throws on database error', async () => {
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: null, error: { message: 'connection failed' } })
      )
      const service = new PriceHistoryService(supabase)

      await expect(service.getHistory('product-1')).rejects.toThrow('Failed to fetch price history')
    })
  })

  // -----------------------------------------------------------------------
  // getTrend
  // -----------------------------------------------------------------------
  describe('getTrend', () => {
    it('detects rising prices', async () => {
      // Prices go from 100 to 300 over 8 weeks -- >5% change per week
      const priceData = generatePriceHistory({ weeks: 8, startPriceCents: 100, endPriceCents: 300 })
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.trend7d).toBe('rising')
      expect(trend.trend30d).toBe('rising')
      expect(trend.currentPriceCents).toBe(300)
      expect(trend.lowestPriceCents).toBe(100)
      expect(trend.highestPriceCents).toBe(300)
    })

    it('detects falling prices and isGoodDeal at lowest', async () => {
      // Prices go from 300 to 200 over 8 weeks
      const priceData = generatePriceHistory({ weeks: 8, startPriceCents: 300, endPriceCents: 200 })
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.trend7d).toBe('falling')
      expect(trend.currentPriceCents).toBe(200)
      expect(trend.percentile).toBe(0) // at the lowest
      expect(trend.isGoodDeal).toBe(true)
    })

    it('detects stable prices', async () => {
      // All same price
      const priceData = generatePriceHistory({ weeks: 8, startPriceCents: 250, endPriceCents: 250 })
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.trend7d).toBe('stable')
      expect(trend.trend30d).toBe('stable')
      expect(trend.percentile).toBe(50) // range is 0, defaults to 50
    })

    it('handles single data point gracefully', async () => {
      const priceData = [
        { price_cents: 250, scraped_at: '2026-04-04T12:00:00Z', is_on_sale: false, original_price_cents: null },
      ]
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.trend7d).toBe('stable')
      expect(trend.trend30d).toBe('stable')
      expect(trend.percentile).toBe(50)
      expect(trend.currentPriceCents).toBe(250)
      expect(trend.averagePriceCents).toBe(250)
    })

    it('calculates percentile correctly', async () => {
      // Create prices: 100, 200, 300 (current is 200 = middle)
      const priceData = [
        { price_cents: 100, scraped_at: '2026-03-01T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 300, scraped_at: '2026-03-15T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 200, scraped_at: '2026-04-04T12:00:00Z', is_on_sale: false, original_price_cents: null },
      ]
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.lowestPriceCents).toBe(100)
      expect(trend.highestPriceCents).toBe(300)
      expect(trend.percentile).toBe(50) // (200-100)/(300-100) * 100 = 50
    })

    it('sets percentile 0 at lowest price', async () => {
      const priceData = [
        { price_cents: 300, scraped_at: '2026-03-01T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 200, scraped_at: '2026-03-15T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 100, scraped_at: '2026-04-04T12:00:00Z', is_on_sale: false, original_price_cents: null },
      ]
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.percentile).toBe(0)
    })

    it('sets percentile 100 at highest price', async () => {
      const priceData = [
        { price_cents: 100, scraped_at: '2026-03-01T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 200, scraped_at: '2026-03-15T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 300, scraped_at: '2026-04-04T12:00:00Z', is_on_sale: false, original_price_cents: null },
      ]
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      expect(trend.percentile).toBe(100)
    })

    it('detects isPriceAlert when price is >110% of 30d average', async () => {
      // Average around 200, current spike to 250 (125% of avg)
      const priceData = [
        { price_cents: 200, scraped_at: '2026-03-10T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 200, scraped_at: '2026-03-17T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 200, scraped_at: '2026-03-24T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 200, scraped_at: '2026-03-31T12:00:00Z', is_on_sale: false, original_price_cents: null },
        { price_cents: 250, scraped_at: '2026-04-04T12:00:00Z', is_on_sale: false, original_price_cents: null },
      ]
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: priceData, error: null })
      )
      const service = new PriceHistoryService(supabase)

      const trend = await service.getTrend('product-1')

      // 30d avg = (200+200+200+200+250)/5 = 210, 250 > 210*1.1 = 231 => true
      expect(trend.isPriceAlert).toBe(true)
    })

    it('throws when no price data exists', async () => {
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: [], error: null })
      )
      const service = new PriceHistoryService(supabase)

      await expect(service.getTrend('product-1')).rejects.toThrow('No price data found')
    })
  })

  // -----------------------------------------------------------------------
  // findPriceChanges
  // -----------------------------------------------------------------------
  describe('findPriceChanges', () => {
    it('detects >10% price drops as deals and >10% increases as alerts', async () => {
      let callCount = 0
      const supabase = createMockSupabase((table: string) => {
        if (table === 'prices') {
          callCount++
          if (callCount === 1) {
            // Current prices query
            return createMockQueryBuilder({
              data: [
                {
                  product_id: 'p1',
                  price_cents: 180, // dropped from 200
                  is_current: true,
                  scraped_at: '2026-04-04T12:00:00Z',
                  products: { name: 'Melk', store_id: 's1', stores: { slug: 'ah' } },
                },
                {
                  product_id: 'p2',
                  price_cents: 330, // increased from 300
                  is_current: true,
                  scraped_at: '2026-04-04T12:00:00Z',
                  products: { name: 'Kaas', store_id: 's2', stores: { slug: 'jumbo' } },
                },
              ],
              error: null,
            })
          }
          // Previous price queries
          if (callCount === 2) {
            return createMockQueryBuilder({ data: [{ price_cents: 200 }], error: null })
          }
          if (callCount === 3) {
            return createMockQueryBuilder({ data: [{ price_cents: 300 }], error: null })
          }
        }
        return createMockQueryBuilder({ data: [], error: null })
      })

      const service = new PriceHistoryService(supabase)
      const changes = await service.findPriceChanges()

      expect(changes).toHaveLength(2)

      const drop = changes.find((c) => c.direction === 'down')!
      expect(drop.productId).toBe('p1')
      expect(drop.productName).toBe('Melk')
      expect(drop.storeSlug).toBe('ah')
      expect(drop.oldPriceCents).toBe(200)
      expect(drop.newPriceCents).toBe(180)
      expect(drop.changeCents).toBe(20)
      expect(drop.changePercent).toBe(10)

      const increase = changes.find((c) => c.direction === 'up')!
      expect(increase.productId).toBe('p2')
      expect(increase.productName).toBe('Kaas')
      expect(increase.storeSlug).toBe('jumbo')
      expect(increase.changePercent).toBe(10)
    })

    it('returns empty array when no price changes exceed threshold', async () => {
      let callCount = 0
      const supabase = createMockSupabase(() => {
        callCount++
        if (callCount === 1) {
          // Current prices - tiny change (1%)
          return createMockQueryBuilder({
            data: [
              {
                product_id: 'p1',
                price_cents: 202,
                is_current: true,
                scraped_at: '2026-04-04T12:00:00Z',
                products: { name: 'Brood', store_id: 's1', stores: { slug: 'ah' } },
              },
            ],
            error: null,
          })
        }
        // Previous price: 200 -> 202 = 1% change, below 10% threshold
        return createMockQueryBuilder({ data: [{ price_cents: 200 }], error: null })
      })

      const service = new PriceHistoryService(supabase)
      const changes = await service.findPriceChanges()

      expect(changes).toHaveLength(0)
    })

    it('returns empty array when no current prices exist', async () => {
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: [], error: null })
      )
      const service = new PriceHistoryService(supabase)
      const changes = await service.findPriceChanges()

      expect(changes).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // getCheapestPrice
  // -----------------------------------------------------------------------
  describe('getCheapestPrice', () => {
    it('returns correct store and price from mock data', async () => {
      let callCount = 0
      const supabase = createMockSupabase((table: string) => {
        callCount++
        if (table === 'products' && callCount === 1) {
          // Product lookup for EAN
          return createMockQueryBuilder({
            data: [{ ean: '8710400005568' }],
            error: null,
          })
        }
        if (table === 'products' && callCount === 2) {
          // Products with same EAN across stores
          return createMockQueryBuilder({
            data: [
              { id: 'p1', stores: { slug: 'ah' }, prices: [{ price_cents: 149 }] },
              { id: 'p2', stores: { slug: 'jumbo' }, prices: [{ price_cents: 129 }] },
              { id: 'p3', stores: { slug: 'lidl' }, prices: [{ price_cents: 139 }] },
            ],
            error: null,
          })
        }
        return createMockQueryBuilder({ data: [], error: null })
      })

      const service = new PriceHistoryService(supabase)
      const result = await service.getCheapestPrice('unified-1')

      expect(result).not.toBeNull()
      expect(result!.storeSlug).toBe('jumbo')
      expect(result!.priceCents).toBe(129)
    })

    it('returns null when product not found', async () => {
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({ data: [], error: null })
      )
      const service = new PriceHistoryService(supabase)
      const result = await service.getCheapestPrice('nonexistent')

      expect(result).toBeNull()
    })

    it('returns null when product has no EAN', async () => {
      const supabase = createMockSupabase(() =>
        createMockQueryBuilder({
          data: [{ ean: null }],
          error: null,
        })
      )
      const service = new PriceHistoryService(supabase)
      const result = await service.getCheapestPrice('no-ean-product')

      expect(result).toBeNull()
    })
  })
})
