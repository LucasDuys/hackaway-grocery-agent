import type { PriceHistory, PriceTrend, PriceChange } from './types'

/** Minimal Supabase client interface for dependency injection / mocking */
export interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder
}

export interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseQueryBuilder
  eq(column: string, value: unknown): SupabaseQueryBuilder
  neq(column: string, value: unknown): SupabaseQueryBuilder
  gte(column: string, value: unknown): SupabaseQueryBuilder
  gt(column: string, value: unknown): SupabaseQueryBuilder
  lt(column: string, value: unknown): SupabaseQueryBuilder
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder
  limit(count: number): SupabaseQueryBuilder
  then: Promise<{ data: unknown; error: { message: string } | null }>['then']
}

interface PriceRow {
  price_cents: number
  scraped_at: string
  is_on_sale: boolean
  original_price_cents: number | null
}

interface PriceChangeRow {
  product_id: string
  price_cents: number
  is_current: boolean
  scraped_at: string
  products: {
    name: string
    store_id: string
    stores: {
      slug: string
    }
  }
}

/**
 * Service for querying price history and computing price trends.
 * All calculations use integer cents to avoid floating point issues.
 */
export class PriceHistoryService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Get price history for a product over a time range.
   * @param productId - UUID of the product
   * @param days - Number of days to look back (default: all history)
   */
  async getHistory(productId: string, days?: number): Promise<PriceHistory> {
    let query = this.supabase
      .from('prices')
      .select('price_cents, scraped_at, is_on_sale, original_price_cents')
      .eq('product_id', productId)
      .order('scraped_at', { ascending: true })

    if (days !== undefined) {
      const since = new Date()
      since.setDate(since.getDate() - days)
      query = query.gte('scraped_at', since.toISOString())
    }

    const { data, error } = await (query as unknown as Promise<{
      data: PriceRow[] | null
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(`Failed to fetch price history: ${error.message}`)
    }

    const rows = (data ?? []) as PriceRow[]

    return {
      productId,
      prices: rows.map((row) => ({
        priceCents: row.price_cents,
        scrapedAt: new Date(row.scraped_at),
        isOnSale: row.is_on_sale,
        originalPriceCents: row.original_price_cents,
      })),
    }
  }

  /**
   * Compute price trend for a product.
   * Analyses the full price history to determine averages, percentiles,
   * and 7d/30d trends.
   */
  async getTrend(productId: string): Promise<PriceTrend> {
    const history = await this.getHistory(productId)
    const prices = history.prices

    if (prices.length === 0) {
      throw new Error(`No price data found for product ${productId}`)
    }

    const allCents = prices.map((p) => p.priceCents)
    const currentPriceCents = allCents[allCents.length - 1]
    const lowestPriceCents = Math.min(...allCents)
    const highestPriceCents = Math.max(...allCents)
    const averagePriceCents = Math.round(
      allCents.reduce((sum, c) => sum + c, 0) / allCents.length
    )

    // Percentile: 0 = cheapest ever, 100 = most expensive ever
    const range = highestPriceCents - lowestPriceCents
    const percentile = range === 0 ? 50 : Math.round(
      ((currentPriceCents - lowestPriceCents) / range) * 100
    )

    // Trend calculations
    const now = prices[prices.length - 1].scrapedAt
    const trend7d = this.computeTrend(prices, currentPriceCents, now, 7)
    const trend30d = this.computeTrend(prices, currentPriceCents, now, 30)

    // isGoodDeal: current price <= 10th percentile
    const isGoodDeal = percentile <= 10

    // isPriceAlert: current price > 110% of 30d average
    const last30d = prices.filter(
      (p) => now.getTime() - p.scrapedAt.getTime() <= 30 * 24 * 60 * 60 * 1000
    )
    const avg30d =
      last30d.length > 0
        ? last30d.reduce((sum, p) => sum + p.priceCents, 0) / last30d.length
        : averagePriceCents
    const isPriceAlert = currentPriceCents > avg30d * 1.1

    return {
      productId,
      currentPriceCents,
      averagePriceCents,
      lowestPriceCents,
      highestPriceCents,
      trend7d,
      trend30d,
      percentile,
      isGoodDeal,
      isPriceAlert,
    }
  }

  /**
   * Find products with significant price changes since last scrape.
   * Returns products with >10% price drop ("deal of the week") or
   * >10% increase ("price alert").
   */
  async findPriceChanges(options?: {
    minChangePercent?: number
  }): Promise<PriceChange[]> {
    const minChangePercent = options?.minChangePercent ?? 10

    // Get current prices with product and store info
    const { data, error } = await (this.supabase
      .from('prices')
      .select('product_id, price_cents, is_current, scraped_at, products(name, store_id, stores(slug))')
      .eq('is_current', true) as unknown as Promise<{
      data: PriceChangeRow[] | null
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(`Failed to fetch current prices: ${error.message}`)
    }

    const currentPrices = (data ?? []) as PriceChangeRow[]

    // For each current price, find the previous price
    const changes: PriceChange[] = []

    for (const current of currentPrices) {
      const { data: prevData, error: prevError } = await (this.supabase
        .from('prices')
        .select('price_cents')
        .eq('product_id', current.product_id)
        .eq('is_current', false)
        .order('scraped_at', { ascending: false })
        .limit(1) as unknown as Promise<{
        data: { price_cents: number }[] | null
        error: { message: string } | null
      }>)

      if (prevError || !prevData || prevData.length === 0) {
        continue
      }

      const oldPriceCents = prevData[0].price_cents
      const newPriceCents = current.price_cents

      if (oldPriceCents === newPriceCents) continue

      const changeCents = newPriceCents - oldPriceCents
      const changePercent = Math.abs(
        Math.round((changeCents / oldPriceCents) * 100)
      )

      if (changePercent < minChangePercent) continue

      changes.push({
        productId: current.product_id,
        productName: current.products.name,
        storeSlug: current.products.stores.slug,
        oldPriceCents,
        newPriceCents,
        changeCents: Math.abs(changeCents),
        changePercent,
        direction: changeCents > 0 ? 'up' : 'down',
      })
    }

    return changes
  }

  /**
   * Get the cheapest current price for a unified product across all stores.
   * Looks up all products sharing the same EAN, then finds the lowest
   * current price among them.
   */
  async getCheapestPrice(
    unifiedProductId: string
  ): Promise<{ storeSlug: string; priceCents: number } | null> {
    // First get the EAN for this product
    const { data: productData, error: productError } = await (this.supabase
      .from('products')
      .select('ean')
      .eq('id', unifiedProductId)
      .limit(1) as unknown as Promise<{
      data: { ean: string }[] | null
      error: { message: string } | null
    }>)

    if (productError || !productData || productData.length === 0) {
      return null
    }

    const ean = productData[0].ean
    if (!ean) return null

    // Find all products with same EAN and their current prices
    const { data, error } = await (this.supabase
      .from('products')
      .select('id, stores(slug), prices(price_cents)')
      .eq('ean', ean) as unknown as Promise<{
      data: {
        id: string
        stores: { slug: string }
        prices: { price_cents: number }[]
      }[] | null
      error: { message: string } | null
    }>)

    if (error || !data || data.length === 0) {
      return null
    }

    let cheapest: { storeSlug: string; priceCents: number } | null = null

    for (const product of data) {
      if (!product.prices || product.prices.length === 0) continue
      const priceCents = product.prices[0].price_cents
      if (cheapest === null || priceCents < cheapest.priceCents) {
        cheapest = {
          storeSlug: product.stores.slug,
          priceCents,
        }
      }
    }

    return cheapest
  }

  /**
   * Compute trend direction by comparing current price to price N days ago.
   * >5% change = rising/falling, else stable.
   */
  private computeTrend(
    prices: { priceCents: number; scrapedAt: Date }[],
    currentPriceCents: number,
    now: Date,
    days: number
  ): 'rising' | 'falling' | 'stable' {
    const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Find the price closest to N days ago
    let closest = prices[0]
    let closestDiff = Math.abs(prices[0].scrapedAt.getTime() - targetDate.getTime())

    for (const p of prices) {
      const diff = Math.abs(p.scrapedAt.getTime() - targetDate.getTime())
      if (diff < closestDiff) {
        closest = p
        closestDiff = diff
      }
    }

    const changePct =
      ((currentPriceCents - closest.priceCents) / closest.priceCents) * 100

    if (changePct > 5) return 'rising'
    if (changePct < -5) return 'falling'
    return 'stable'
  }
}
