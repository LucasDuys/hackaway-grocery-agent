import { BaseScraper } from './base-scraper'
import { RateLimiter } from './rate-limiter'
import type {
  ScrapedProduct,
  ScrapeResult,
  ScrapeError,
  UnitType,
} from './types'

/**
 * Picnic product as returned by the storefront API.
 * Prices are in euro cents (integer).
 */
interface PicnicProduct {
  type: string
  id: string
  name: string
  price: number
  unit_quantity: string
  unit_quantity_sub?: string
  image_id: string | null
  max_count: number
  sold_out: boolean
  decorators: PicnicDecorator[]
  fresh_label: { text: string } | null
  ean?: string | null
}

interface PicnicDecorator {
  type: string
  original_price?: number
}

interface PicnicCategory {
  type: string
  id: string
  name: string
  items: (PicnicCategory | PicnicProduct)[]
}

interface PicnicCatalogResponse {
  catalog: PicnicCategory[]
}

/**
 * Scraper for Picnic (delivery-only supermarket).
 *
 * LIMITATION: Picnic does not expose a publicly browseable product catalog
 * without authentication. Their mobile app uses the storefront API at
 * https://storefront-prod.nl.picnicinternational.com/api/ which requires
 * an auth token obtained via login.
 *
 * The public website (picnic.app) is primarily a marketing page and does
 * not list individual products with prices.
 *
 * This scraper is implemented against the Picnic storefront API response
 * format and will work correctly when catalog data IS available (e.g., via
 * an authenticated session or if Picnic opens their catalog publicly in
 * the future). Without auth, scrape() returns an empty result with a
 * documented error.
 *
 * Set `requiresAuth = true` to indicate this limitation.
 */
export class PicnicScraper extends BaseScraper {
  readonly storeSlug = 'picnic' as const
  readonly storeName = 'Picnic'

  /**
   * Indicates that this scraper requires authentication to fetch products.
   * Without a valid auth token, the scraper returns an empty product list.
   */
  readonly requiresAuth = true

  private readonly baseUrl =
    'https://storefront-prod.nl.picnicinternational.com/api'
  private readonly imageBaseUrl =
    'https://storefront-prod.nl.picnicinternational.com/static/images'
  private readonly rateLimiter = new RateLimiter(1500)

  /**
   * Optional auth token for the Picnic storefront API.
   * Must be set externally before calling scrape() to get real data.
   */
  authToken: string | null = null

  async scrape(): Promise<ScrapeResult> {
    const start = Date.now()
    const products: ScrapedProduct[] = []
    const errors: ScrapeError[] = []

    if (!this.authToken) {
      errors.push({
        url: this.baseUrl,
        message:
          'Picnic requires authentication to access the product catalog. ' +
          'Set authToken before calling scrape(). The public website ' +
          '(picnic.app) does not expose a browseable product catalog.',
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

    try {
      const catalogData = await this.fetchCatalog()
      const parsed = this.parseCatalog(catalogData)
      products.push(...parsed.products)
      errors.push(...parsed.errors)
    } catch (error) {
      errors.push({
        url: `${this.baseUrl}/v2/catalog`,
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error fetching catalog',
        phase: 'fetch',
      })
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
   * Fetch the full product catalog from the Picnic API.
   */
  private async fetchCatalog(): Promise<PicnicCatalogResponse> {
    await this.rateLimiter.wait()

    const response = await this.withRetry(
      async () => {
        const res = await fetch(`${this.baseUrl}/v2/catalog`, {
          headers: {
            'x-picnic-auth': this.authToken!,
            'User-Agent': 'okhttp/4.9.2',
            Accept: 'application/json',
          },
        })

        if (!res.ok) {
          const err = new Error(`Picnic API returned ${res.status}`)
          ;(err as any).status = res.status
          throw err
        }

        return res.json() as Promise<PicnicCatalogResponse>
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        isRetryable: (error: unknown) => {
          if (error instanceof Error && 'status' in error) {
            const status = (error as any).status
            // Don't retry auth errors or not found
            return status !== 401 && status !== 403 && status !== 404
          }
          return true
        },
      }
    )

    return response
  }

  /**
   * Parse the catalog response into ScrapedProducts.
   * Recursively traverses nested categories to extract all products.
   */
  parseCatalog(data: PicnicCatalogResponse): {
    products: ScrapedProduct[]
    errors: ScrapeError[]
  } {
    const products: ScrapedProduct[] = []
    const errors: ScrapeError[] = []

    for (const category of data.catalog) {
      this.extractProducts(category, [], products, errors)
    }

    return { products, errors }
  }

  /**
   * Recursively extract products from nested category structure.
   * Builds up category breadcrumb path as it descends.
   */
  private extractProducts(
    node: PicnicCategory | PicnicProduct,
    categoryPath: string[],
    products: ScrapedProduct[],
    errors: ScrapeError[]
  ): void {
    if (node.type === 'CATEGORY') {
      const category = node as PicnicCategory
      const newPath = [...categoryPath, category.name]
      for (const item of category.items) {
        this.extractProducts(item, newPath, products, errors)
      }
      return
    }

    if (node.type === 'SINGLE_ARTICLE') {
      const product = node as PicnicProduct

      // Skip products with empty names
      if (!product.name || !product.name.trim()) {
        errors.push({
          url: `picnic://product/${product.id}`,
          message: `Product ${product.id} has no name, skipping`,
          phase: 'parse',
        })
        return
      }

      try {
        const scraped = this.mapProduct(product, categoryPath)
        products.push(scraped)
      } catch (error) {
        errors.push({
          url: `picnic://product/${product.id}`,
          message:
            error instanceof Error
              ? error.message
              : `Failed to parse product ${product.id}`,
          phase: 'parse',
        })
      }
    }
  }

  /**
   * Map a Picnic API product to our ScrapedProduct interface.
   *
   * Picnic API prices are already in cents (integer), unlike website
   * prices which are displayed in euros.
   */
  private mapProduct(
    product: PicnicProduct,
    categoryPath: string[]
  ): ScrapedProduct {
    const { unitSize, unitType } = this.parseUnitQuantity(
      product.unit_quantity
    )

    // Check for sale decorator
    const priceDownDecorator = product.decorators.find(
      (d) => d.type === 'PRICE_DOWN'
    )
    const isOnSale = !!priceDownDecorator
    const originalPriceCents = priceDownDecorator?.original_price ?? null

    // Build image URL from image_id
    const imageUrl = product.image_id
      ? `${this.imageBaseUrl}/${product.image_id}.png`
      : null

    // Extract brand from name (Picnic products often start with brand)
    const brand = this.extractBrand(product.name)

    // Validate EAN if present
    const ean =
      product.ean && this.validateEan(product.ean) ? product.ean : null

    // Calculate price per unit if possible
    const pricePerUnitCents = this.calculatePricePerUnit(
      product.price,
      unitSize,
      unitType
    )

    return {
      name: product.name,
      brand,
      ean,
      priceCents: product.price,
      pricePerUnitCents,
      unitSize,
      unitType,
      imageUrl,
      categoryRaw: categoryPath.join(' > '),
      sourceUrl: `https://picnic.app/nl/product/${product.id}`,
      isOnSale,
      originalPriceCents,
      nutrition: null, // Picnic API catalog endpoint does not include nutrition
    }
  }

  /**
   * Parse Picnic unit_quantity string into size and type.
   * Examples: "1 L", "500 g", "10 stuks", "6 x 330 ml", "800 g"
   */
  parseUnitQuantity(raw: string): { unitSize: string; unitType: UnitType } {
    const trimmed = raw.trim()

    // Handle composite format like "6 x 330 ml"
    const compositeMatch = trimmed.match(
      /^(\d+)\s*x\s*(\d+)\s*(ml|l|g|kg|stuks?|stuk)$/i
    )
    if (compositeMatch) {
      const count = parseInt(compositeMatch[1], 10)
      const perUnit = parseInt(compositeMatch[2], 10)
      const unit = compositeMatch[3]
      const total = count * perUnit
      return {
        unitSize: `${total} ${unit}`,
        unitType: this.normalizeUnitType(unit),
      }
    }

    // Handle simple format like "1 L", "500 g", "10 stuks"
    const simpleMatch = trimmed.match(
      /^([\d.,]+)\s*(ml|l|g|kg|stuks?|stuk)$/i
    )
    if (simpleMatch) {
      return {
        unitSize: trimmed,
        unitType: this.normalizeUnitType(simpleMatch[2]),
      }
    }

    // Fallback: return as-is with 'stuk' default
    return {
      unitSize: trimmed,
      unitType: 'stuk',
    }
  }

  /**
   * Extract brand name from product name.
   * Picnic's own brand products start with "Picnic".
   * Other brands are typically the first word(s) before the product type.
   * Returns null if no brand can be determined.
   */
  private extractBrand(name: string): string | null {
    // Known store brand
    if (name.startsWith('Picnic ')) {
      return 'Picnic'
    }

    // Known national brands that commonly appear in Picnic
    const knownBrands = [
      'Arla',
      'Campina',
      'Optimel',
      'Hertog',
      'Unox',
      'Calvé',
      'Johma',
      'Lay\'s',
      'Doritos',
      'Coca-Cola',
      'Pepsi',
      'Heineken',
      'Grolsch',
    ]

    for (const brand of knownBrands) {
      if (name.startsWith(brand + ' ') || name === brand) {
        return brand
      }
    }

    return null
  }

  /**
   * Calculate price per standard unit (per kg, per L, per stuk).
   * Returns null if calculation is not possible.
   */
  private calculatePricePerUnit(
    priceCents: number,
    unitSize: string,
    unitType: UnitType
  ): number | null {
    const quantityMatch = unitSize.match(/^([\d.,]+)/)
    if (!quantityMatch) return null

    const quantity = parseFloat(quantityMatch[1].replace(',', '.'))
    if (quantity <= 0 || isNaN(quantity)) return null

    switch (unitType) {
      case 'kg':
        // Price is already per kg-quantity, normalize to per kg
        return Math.round(priceCents / quantity)
      case 'g':
        // Convert to per kg
        return Math.round((priceCents / quantity) * 1000)
      case 'L':
        // Price per liter
        return Math.round(priceCents / quantity)
      case 'ml':
        // Convert to per liter
        return Math.round((priceCents / quantity) * 1000)
      case 'stuk':
        // Price per piece
        return Math.round(priceCents / quantity)
      default:
        return null
    }
  }
}
