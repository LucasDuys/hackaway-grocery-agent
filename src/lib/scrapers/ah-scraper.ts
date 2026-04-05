import { BaseScraper } from './base-scraper'
import { RateLimiter } from './rate-limiter'
import type {
  ScrapedProduct,
  ScrapeResult,
  ScrapeError,
  UnitType,
} from './types'

/** Shape of a single product returned by the AH search API */
interface AhApiProduct {
  webshopId: number
  title: string
  brand: string | null
  category: string | null
  gtins: string[] | null
  images: { url: string; width: number; height: number }[]
  price: {
    now: number
    was: number | null
    unitSize: string | null
  }
  unitPriceDescription: string | null
  discount: {
    bonusType: string
    segmentType: string
    startDate: string
    endDate: string
  } | null
  link: string
}

/** Shape of the AH search API response */
interface AhApiResponse {
  cards: {
    products: AhApiProduct[]
  }[]
  page: {
    totalPages: number
    size: number
    totalElements: number
  }
}

/** Category descriptor used for scraping */
interface AhCategory {
  id: number
  slug: string
  name: string
}

const AH_BASE_URL = 'https://www.ah.nl'
const AH_SEARCH_API = `${AH_BASE_URL}/zoeken/api/products/search`
const AH_TAXONOMY_API = `${AH_BASE_URL}/zoeken/api/products/taxonomy`

/**
 * Scraper for Albert Heijn (ah.nl).
 *
 * Uses the public product search API which returns JSON.
 * No authentication required. Products are fetched category
 * by category with pagination.
 */
export class AhScraper extends BaseScraper {
  readonly storeSlug = 'ah' as const
  readonly storeName = 'Albert Heijn'

  private rateLimiter = new RateLimiter(1000)

  async scrape(): Promise<ScrapeResult> {
    const start = Date.now()
    const products: ScrapedProduct[] = []
    const errors: ScrapeError[] = []

    let categories: AhCategory[]
    try {
      categories = await this.fetchCategories()
    } catch (err) {
      errors.push({
        url: AH_TAXONOMY_API,
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
          url: `${AH_SEARCH_API}?taxonomySlug=${category.slug}`,
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
   * Fetch top-level product categories from the AH taxonomy API.
   */
  private async fetchCategories(): Promise<AhCategory[]> {
    await this.rateLimiter.wait()

    const response = await this.withRetry(
      () => fetch(AH_TAXONOMY_API, { headers: this.getHeaders() }),
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        isRetryable: (err) => this.isRetryableError(err),
      }
    )

    if (!response.ok) {
      throw new Error(`Taxonomy API returned ${response.status}`)
    }

    const data = await response.json()

    // The taxonomy response is an array of category objects
    return (data as { id: number; slugifiedName: string; name: string }[]).map(
      (cat) => ({
        id: cat.id,
        slug: cat.slugifiedName,
        name: cat.name,
      })
    )
  }

  /**
   * Scrape all products for a single category, handling pagination.
   * Errors for individual pages are collected without aborting.
   */
  private async scrapeCategory(
    category: AhCategory,
    errors: ScrapeError[]
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = []
    let page = 0
    let totalPages = 1

    while (page < totalPages) {
      await this.rateLimiter.wait()

      const url = `${AH_SEARCH_API}?taxonomySlug=${category.slug}&page=${page}&size=36`

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
        page++
        continue
      }

      if (!response.ok) {
        errors.push({
          url,
          message: `HTTP ${response.status}`,
          phase: 'fetch',
        })
        page++
        continue
      }

      let data: AhApiResponse
      try {
        data = (await response.json()) as AhApiResponse
      } catch (err) {
        errors.push({
          url,
          message: err instanceof Error ? err.message : String(err),
          phase: 'parse',
        })
        page++
        continue
      }

      totalPages = data.page.totalPages

      for (const card of data.cards) {
        for (const ahProduct of card.products) {
          try {
            const product = this.mapProduct(ahProduct, category.name)
            products.push(product)
          } catch (err) {
            errors.push({
              url: this.buildProductUrl(ahProduct),
              message: err instanceof Error ? err.message : String(err),
              phase: 'parse',
            })
          }
        }
      }

      page++
    }

    return products
  }

  /**
   * Map a raw AH API product to the standard ScrapedProduct format.
   */
  private mapProduct(
    ahProduct: AhApiProduct,
    categoryName: string
  ): ScrapedProduct {
    const priceCents = Math.round(ahProduct.price.now * 100)
    const isOnSale = ahProduct.discount !== null && ahProduct.price.was !== null
    const originalPriceCents = isOnSale && ahProduct.price.was !== null
      ? Math.round(ahProduct.price.was * 100)
      : null

    const imageUrl =
      ahProduct.images.length > 0 ? ahProduct.images[0].url : null

    const ean = this.extractEan(ahProduct.gtins)

    const { unitSize, unitType } = this.parseUnitInfo(
      ahProduct.price.unitSize
    )

    const pricePerUnitCents = this.parsePricePerUnit(
      ahProduct.unitPriceDescription
    )

    return {
      name: ahProduct.title,
      brand: ahProduct.brand ?? null,
      ean,
      priceCents,
      pricePerUnitCents,
      unitSize,
      unitType,
      imageUrl,
      categoryRaw: categoryName,
      sourceUrl: this.buildProductUrl(ahProduct),
      isOnSale,
      originalPriceCents,
      nutrition: null,
    }
  }

  /**
   * Build the canonical product URL from the AH product data.
   */
  private buildProductUrl(ahProduct: AhApiProduct): string {
    return `${AH_BASE_URL}/producten/product/${ahProduct.webshopId}/${ahProduct.link}`
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
   * Parse the unit size string (e.g., "1 kg", "500 ml", "6 stuks")
   * into a size string and a normalized UnitType.
   */
  private parseUnitInfo(unitSizeRaw: string | null): {
    unitSize: string
    unitType: UnitType
  } {
    if (!unitSizeRaw) {
      return { unitSize: '1 stuk', unitType: 'stuk' }
    }

    const trimmed = unitSizeRaw.trim().toLowerCase()

    // Try to match patterns like "1 kg", "500 ml", "6 stuks", "750 g"
    const match = trimmed.match(
      /^([\d,.]+)\s*(kg|kilogram|kilo|g|gram|l|liter|litre|ml|milliliter|millilitre|stuk|stuks|st)$/i
    )

    if (match) {
      try {
        const unitType = this.normalizeUnitType(match[2])
        return { unitSize: unitSizeRaw.trim(), unitType }
      } catch {
        return { unitSize: unitSizeRaw.trim(), unitType: 'stuk' }
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
          return { unitSize: unitSizeRaw.trim(), unitType }
        } catch {
          // Fall through
        }
      }
    }

    return { unitSize: unitSizeRaw.trim(), unitType: 'stuk' }
  }

  /**
   * Parse the unit price description (e.g., "2.49/kg", "1.99/L")
   * into cents per unit. Returns null if unparseable.
   */
  private parsePricePerUnit(description: string | null): number | null {
    if (!description) {
      return null
    }

    // AH format: "EUR 2.49/kg" or "2.49/liter" or similar
    const match = description.match(
      /(?:EUR?\s*)?€?\s*([\d]+[.,][\d]+)\s*\/\s*\w+/i
    )

    if (!match) {
      return null
    }

    try {
      return this.parsePrice(match[1])
    } catch {
      return null
    }
  }

  /**
   * Determine if an error should be retried.
   * Rate limit (429) and server errors (5xx) are retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for fetch/network errors (always retryable)
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
   * Standard headers for AH API requests.
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
