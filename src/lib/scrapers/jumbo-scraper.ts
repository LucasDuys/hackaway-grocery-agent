import { BaseScraper } from './base-scraper'
import { RateLimiter } from './rate-limiter'
import type {
  ScrapedProduct,
  ScrapeResult,
  ScrapeError,
  UnitType,
} from './types'

/** Shape of a single product returned by the Jumbo search API */
interface JumboApiProduct {
  id: string
  title: string
  brand: string | null
  category: string | null
  sku: string
  gtins: string[] | null
  imageInfo: {
    primaryView: { url: string; width: number; height: number }[]
  }
  prices: {
    price: { currency: string; amount: number }
    promotionalPrice: { currency: string; amount: number } | null
    unitPrice: {
      unit: string
      price: { currency: string; amount: number }
    } | null
  }
  quantity: string
  link: string
}

/** Shape of the Jumbo search API response */
interface JumboSearchResponse {
  products: {
    data: JumboApiProduct[]
    total: number
    offset: number
    count: number
  }
  filters: Record<string, unknown>
}

/** Category descriptor used for scraping */
interface JumboCategory {
  id: string
  title: string
}

const JUMBO_BASE_URL = 'https://www.jumbo.com'
const JUMBO_SEARCH_API = `${JUMBO_BASE_URL}/api/graphql`
const JUMBO_CATEGORIES_API = `${JUMBO_BASE_URL}/api/categories`

/** Product page size for pagination */
const PAGE_SIZE = 24

/**
 * Scraper for Jumbo (jumbo.com).
 *
 * Uses the public product search API which returns JSON.
 * No authentication required. Products are fetched category
 * by category with pagination.
 */
export class JumboScraper extends BaseScraper {
  readonly storeSlug = 'jumbo' as const
  readonly storeName = 'Jumbo'

  private rateLimiter = new RateLimiter(1000)

  async scrape(): Promise<ScrapeResult> {
    const start = Date.now()
    const products: ScrapedProduct[] = []
    const errors: ScrapeError[] = []

    let categories: JumboCategory[]
    try {
      categories = await this.fetchCategories()
    } catch (err) {
      errors.push({
        url: JUMBO_CATEGORIES_API,
        message: err instanceof Error ? err.message : String(err),
        phase: 'fetch',
      })
      return {
        storeSlug: this.storeSlug,
        products: [],
        errors,
        durationMs: Date.now() - start,
        scrapedAt: new Date(),
      }
    }

    for (const category of categories) {
      try {
        const categoryProducts = await this.scrapeCategory(category, errors)
        products.push(...categoryProducts)
      } catch (err) {
        errors.push({
          url: `${JUMBO_SEARCH_API}?category=${category.id}`,
          message: err instanceof Error ? err.message : String(err),
          phase: 'fetch',
        })
      }
    }

    return {
      storeSlug: this.storeSlug,
      products,
      errors,
      durationMs: Date.now() - start,
      scrapedAt: new Date(),
    }
  }

  /**
   * Fetch top-level product categories from the Jumbo API.
   */
  private async fetchCategories(): Promise<JumboCategory[]> {
    await this.rateLimiter.wait()

    const response = await this.withRetry(
      () => fetch(JUMBO_CATEGORIES_API, { headers: this.getHeaders() }),
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        isRetryable: (err) => this.isRetryableError(err),
      }
    )

    if (!response.ok) {
      throw new Error(`Categories API returned ${response.status}`)
    }

    const data = await response.json()

    return (data as { id: string; title: string }[]).map((cat) => ({
      id: cat.id,
      title: cat.title,
    }))
  }

  /**
   * Scrape all products for a single category, handling pagination.
   * Errors for individual pages are collected without aborting.
   */
  private async scrapeCategory(
    category: JumboCategory,
    errors: ScrapeError[]
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = []
    let offset = 0
    let total = 1

    while (offset < total) {
      await this.rateLimiter.wait()

      const url = `${JUMBO_SEARCH_API}?category=${category.id}&offset=${offset}&count=${PAGE_SIZE}`

      let response: Response
      try {
        response = await this.withRetry(
          () => fetch(url, { headers: this.getHeaders() }),
          {
            maxRetries: 3,
            baseDelayMs: 1000,
            isRetryable: (err) => this.isRetryableError(err),
          }
        )
      } catch (err) {
        errors.push({
          url,
          message: err instanceof Error ? err.message : String(err),
          phase: 'fetch',
        })
        offset += PAGE_SIZE
        continue
      }

      if (!response.ok) {
        errors.push({
          url,
          message: `HTTP ${response.status}`,
          phase: 'fetch',
        })
        offset += PAGE_SIZE
        continue
      }

      let data: JumboSearchResponse
      try {
        data = (await response.json()) as JumboSearchResponse
      } catch (err) {
        errors.push({
          url,
          message: err instanceof Error ? err.message : String(err),
          phase: 'parse',
        })
        offset += PAGE_SIZE
        continue
      }

      total = data.products.total

      for (const product of data.products.data) {
        try {
          const mapped = this.mapProduct(product, category.title)
          products.push(mapped)
        } catch (err) {
          errors.push({
            url: this.buildProductUrl(product),
            message: err instanceof Error ? err.message : String(err),
            phase: 'parse',
          })
        }
      }

      offset += PAGE_SIZE
    }

    return products
  }

  /**
   * Map a raw Jumbo API product to the standard ScrapedProduct format.
   *
   * Jumbo prices are in integer cents. When a promotionalPrice is present,
   * that becomes the current price and the regular price becomes the
   * original price (sale scenario).
   */
  private mapProduct(
    product: JumboApiProduct,
    categoryName: string
  ): ScrapedProduct {
    const hasPromo = product.prices.promotionalPrice !== null
    const priceCents = hasPromo
      ? product.prices.promotionalPrice!.amount
      : product.prices.price.amount
    const originalPriceCents = hasPromo
      ? product.prices.price.amount
      : null

    const imageUrl =
      product.imageInfo.primaryView.length > 0
        ? product.imageInfo.primaryView[0].url
        : null

    const ean = this.extractEan(product.gtins)

    const { unitSize, unitType } = this.parseUnitInfo(product.quantity)

    const pricePerUnitCents = product.prices.unitPrice
      ? product.prices.unitPrice.price.amount
      : null

    return {
      name: product.title,
      brand: product.brand ?? null,
      ean,
      priceCents,
      pricePerUnitCents,
      unitSize,
      unitType,
      imageUrl,
      categoryRaw: categoryName,
      sourceUrl: this.buildProductUrl(product),
      isOnSale: hasPromo,
      originalPriceCents,
      nutrition: null,
    }
  }

  /**
   * Build the canonical product URL from the Jumbo product data.
   */
  private buildProductUrl(product: JumboApiProduct): string {
    return `${JUMBO_BASE_URL}${product.link}`
  }

  /**
   * Extract and validate the first valid EAN from the list of GTINs.
   */
  private extractEan(gtins: string[] | null): string | null {
    if (!gtins || gtins.length === 0) {
      return null
    }

    for (const gtin of gtins) {
      if (this.validateEan(gtin)) {
        return gtin
      }
    }

    return null
  }

  /**
   * Parse the unit size string (e.g., "1 liter", "500 ml", "6 stuks")
   * into a size string and a normalized UnitType.
   */
  private parseUnitInfo(quantityRaw: string): {
    unitSize: string
    unitType: UnitType
  } {
    if (!quantityRaw) {
      return { unitSize: '1 stuk', unitType: 'stuk' }
    }

    const trimmed = quantityRaw.trim().toLowerCase()

    const match = trimmed.match(
      /^([\d,.]+)\s*(kg|kilogram|kilo|g|gram|l|liter|litre|ml|milliliter|millilitre|stuk|stuks|st)$/i
    )

    if (match) {
      try {
        const unitType = this.normalizeUnitType(match[2])
        return { unitSize: quantityRaw.trim(), unitType }
      } catch {
        return { unitSize: quantityRaw.trim(), unitType: 'stuk' }
      }
    }

    // Check if the string ends with a recognizable unit
    const unitPatterns: { pattern: RegExp; unit: string }[] = [
      { pattern: /kg$/i, unit: 'kg' },
      { pattern: /kilo$/i, unit: 'kilogram' },
      { pattern: /gram$/i, unit: 'gram' },
      { pattern: /\bg$/i, unit: 'g' },
      { pattern: /liter$/i, unit: 'liter' },
      { pattern: /\bl$/i, unit: 'l' },
      { pattern: /ml$/i, unit: 'ml' },
      { pattern: /stuks?$/i, unit: 'stuk' },
    ]

    for (const { pattern, unit } of unitPatterns) {
      if (pattern.test(trimmed)) {
        try {
          const unitType = this.normalizeUnitType(unit)
          return { unitSize: quantityRaw.trim(), unitType }
        } catch {
          // Fall through
        }
      }
    }

    return { unitSize: quantityRaw.trim(), unitType: 'stuk' }
  }

  /**
   * Determine if an error should be retried.
   * Rate limit (429) and server errors (5xx) are retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT')
      ) {
        return true
      }
    }
    return true
  }

  /**
   * Standard headers for Jumbo API requests.
   */
  private getHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'nl-NL,nl;q=0.9',
    }
  }
}
