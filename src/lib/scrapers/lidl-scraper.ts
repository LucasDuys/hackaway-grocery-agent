import { BaseScraper } from './base-scraper'
import { RateLimiter } from './rate-limiter'
import type {
  ScrapedProduct,
  ScrapeResult,
  ScrapeError,
  UnitType,
} from './types'

/** Shape of a product tile in Lidl's embedded JSON catalog data */
interface LidlRawProduct {
  productId?: string
  fullTitle?: string
  title?: string
  name?: string
  price?: {
    price?: number
    oldPrice?: number
    currency?: string
  }
  image?: string
  imageUrl?: string
  category?: string
  categoryPath?: string
  unit?: string
  unitPrice?: string
  isSpecial?: boolean
  stockAvailability?: string
  canonicalUrl?: string
  keyfacts?: {
    contentData?: Array<{ name?: string; value?: string }>
  }
}

/** Shape of the catalog JSON embedded in Lidl's HTML pages */
interface LidlCatalogResponse {
  items?: LidlRawProduct[]
  products?: LidlRawProduct[]
  totalCount?: number
}

const LIDL_BASE_URL = 'https://www.lidl.nl'

/**
 * Category paths on Lidl's website that cover the permanent range.
 * These are fetched sequentially with rate limiting.
 */
const CATEGORY_PATHS = [
  '/c/zuivel-eieren/s10017',
  '/c/kaas/s10018',
  '/c/vlees-vis/s10019',
  '/c/groente-fruit/s10020',
  '/c/brood-banket/s10021',
  '/c/dranken/s10022',
  '/c/ontbijt-beleg/s10023',
  '/c/pasta-rijst-wereldkeuken/s10024',
  '/c/diepvries/s10025',
  '/c/snoep-koek-chips/s10026',
  '/c/huishouden/s10027',
]

/** The weekly specials page */
const SPECIALS_PATH = '/c/aanbiedingen/s10001'

/**
 * Scraper for Lidl Netherlands (lidl.nl).
 *
 * Strategy: Lidl's website embeds product catalog data as JSON inside
 * script tags (__NEXT_DATA__ or inline JSON-LD / catalog payloads).
 * We fetch the HTML via HTTP and extract the embedded JSON, avoiding
 * the need for a headless browser.
 *
 * Lidl rarely exposes EAN barcodes on their website, so ean is null
 * for most products. Weekly specials ("aanbiedingen") are flagged via
 * categoryRaw containing "[aanbiedingen]".
 */
export class LidlScraper extends BaseScraper {
  readonly storeSlug = 'lidl' as const
  readonly storeName = 'Lidl'

  private rateLimiter = new RateLimiter(1500)

  async scrape(): Promise<ScrapeResult> {
    const startTime = Date.now()
    const allProducts: ScrapedProduct[] = []
    const errors: ScrapeError[] = []

    // Scrape permanent range categories
    for (const categoryPath of CATEGORY_PATHS) {
      try {
        await this.rateLimiter.wait()
        const products = await this.withRetry(
          () => this.scrapeCategory(categoryPath, false),
          { maxRetries: 2, baseDelayMs: 2000 }
        )
        allProducts.push(...products)
      } catch (error) {
        errors.push({
          url: `${LIDL_BASE_URL}${categoryPath}`,
          message: error instanceof Error ? error.message : String(error),
          phase: 'fetch',
        })
      }
    }

    // Scrape weekly specials
    try {
      await this.rateLimiter.wait()
      const specials = await this.withRetry(
        () => this.scrapeCategory(SPECIALS_PATH, true),
        { maxRetries: 2, baseDelayMs: 2000 }
      )
      allProducts.push(...specials)
    } catch (error) {
      errors.push({
        url: `${LIDL_BASE_URL}${SPECIALS_PATH}`,
        message: error instanceof Error ? error.message : String(error),
        phase: 'fetch',
      })
    }

    return {
      storeSlug: 'lidl',
      products: allProducts,
      errors,
      durationMs: Date.now() - startTime,
      scrapedAt: new Date(),
    }
  }

  /**
   * Scrape a single Lidl category page and return parsed products.
   * Fetches the HTML and extracts embedded JSON data.
   */
  async scrapeCategory(
    categoryPath: string,
    isSpecials: boolean
  ): Promise<ScrapedProduct[]> {
    const url = `${LIDL_BASE_URL}${categoryPath}`
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`)
    }

    const html = await response.text()
    const rawProducts = this.extractProductsFromHtml(html)

    return rawProducts
      .map((raw) => this.parseProduct(raw, categoryPath, isSpecials))
      .filter((p): p is ScrapedProduct => p !== null)
  }

  /**
   * Extract product data from Lidl's HTML page.
   * Looks for __NEXT_DATA__ JSON, JSON-LD product schemas,
   * or inline catalog JSON payloads.
   */
  extractProductsFromHtml(html: string): LidlRawProduct[] {
    // Strategy 1: __NEXT_DATA__ (Next.js embedded JSON)
    const nextDataMatch = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    )
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const products = this.extractFromNextData(nextData)
        if (products.length > 0) return products
      } catch {
        // Fall through to next strategy
      }
    }

    // Strategy 2: JSON-LD product data
    const jsonLdProducts = this.extractJsonLd(html)
    if (jsonLdProducts.length > 0) return jsonLdProducts

    // Strategy 3: Inline catalog JSON (window.__CATALOG__ or similar)
    const catalogMatch = html.match(
      /window\.__(?:CATALOG|INITIAL_STATE|DATA)__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/
    )
    if (catalogMatch) {
      try {
        const catalog: LidlCatalogResponse = JSON.parse(catalogMatch[1])
        const items = catalog.items ?? catalog.products ?? []
        if (items.length > 0) return items
      } catch {
        // Fall through
      }
    }

    return []
  }

  /**
   * Navigate the __NEXT_DATA__ JSON tree to find product arrays.
   * Lidl's Next.js data can nest products in various locations.
   */
  private extractFromNextData(data: Record<string, unknown>): LidlRawProduct[] {
    const products: LidlRawProduct[] = []

    const search = (obj: unknown, depth: number): void => {
      if (depth > 8 || !obj || typeof obj !== 'object') return

      if (Array.isArray(obj)) {
        // Check if this is an array of product-like objects
        const hasProducts = obj.some(
          (item) =>
            item &&
            typeof item === 'object' &&
            ('fullTitle' in item || 'title' in item || 'name' in item) &&
            'price' in item
        )
        if (hasProducts) {
          for (const item of obj) {
            if (item && typeof item === 'object' && 'price' in item) {
              products.push(item as LidlRawProduct)
            }
          }
          return
        }
        for (const item of obj) {
          search(item, depth + 1)
        }
      } else {
        for (const value of Object.values(obj as Record<string, unknown>)) {
          search(value, depth + 1)
        }
      }
    }

    search(data, 0)
    return products
  }

  /**
   * Extract product data from JSON-LD script tags.
   */
  private extractJsonLd(html: string): LidlRawProduct[] {
    const products: LidlRawProduct[] = []
    const scriptPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
    let match: RegExpExecArray | null

    while ((match = scriptPattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]

        for (const item of items) {
          if (item['@type'] === 'Product' && item.offers) {
            const offer = Array.isArray(item.offers)
              ? item.offers[0]
              : item.offers
            products.push({
              fullTitle: item.name,
              price: {
                price: parseFloat(offer.price),
                currency: offer.priceCurrency,
              },
              image: item.image,
              canonicalUrl: item.url,
            })
          }
        }
      } catch {
        // Skip malformed JSON-LD blocks
      }
    }

    return products
  }

  /**
   * Parse a raw Lidl product into a ScrapedProduct.
   * Returns null if critical data (name, price) is missing.
   */
  parseProduct(
    raw: LidlRawProduct,
    categoryPath: string,
    isSpecials: boolean
  ): ScrapedProduct | null {
    const name = raw.fullTitle ?? raw.title ?? raw.name
    if (!name) return null

    const priceCents = this.extractPriceCents(raw)
    if (priceCents === null) return null

    const originalPriceCents = this.extractOriginalPriceCents(raw)
    const isOnSale =
      isSpecials || (originalPriceCents !== null && originalPriceCents > priceCents)

    const { unitSize, unitType } = this.extractUnitInfo(raw)

    const imageUrl = raw.image ?? raw.imageUrl ?? null

    // Build category with specials flag
    const categoryRaw = isSpecials
      ? `[aanbiedingen] ${raw.category ?? raw.categoryPath ?? categoryPath}`
      : raw.category ?? raw.categoryPath ?? categoryPath

    const sourceUrl = raw.canonicalUrl
      ? raw.canonicalUrl.startsWith('http')
        ? raw.canonicalUrl
        : `${LIDL_BASE_URL}${raw.canonicalUrl}`
      : `${LIDL_BASE_URL}${categoryPath}`

    return {
      name: name.trim(),
      brand: null,
      ean: null,
      priceCents,
      pricePerUnitCents: this.extractPricePerUnit(raw),
      unitSize,
      unitType,
      imageUrl,
      categoryRaw,
      sourceUrl,
      isOnSale,
      originalPriceCents: isOnSale ? originalPriceCents : null,
      nutrition: null,
    }
  }

  /**
   * Extract price in cents from raw product data.
   * Lidl prices can appear as numeric values (euros) or formatted strings.
   */
  private extractPriceCents(raw: LidlRawProduct): number | null {
    if (raw.price?.price != null) {
      const euros = raw.price.price
      if (typeof euros === 'number' && euros >= 0) {
        return Math.round(euros * 100)
      }
      if (typeof euros === 'string') {
        try {
          return this.parsePrice(euros as string)
        } catch {
          return null
        }
      }
    }
    return null
  }

  /**
   * Extract original (pre-discount) price in cents.
   */
  private extractOriginalPriceCents(raw: LidlRawProduct): number | null {
    if (raw.price?.oldPrice != null) {
      const euros = raw.price.oldPrice
      if (typeof euros === 'number' && euros > 0) {
        return Math.round(euros * 100)
      }
    }
    return null
  }

  /**
   * Extract unit size and type from product data.
   * Falls back to "stuk" if no unit info is available.
   */
  private extractUnitInfo(raw: LidlRawProduct): {
    unitSize: string
    unitType: UnitType
  } {
    const unitStr = raw.unit ?? ''

    // Try to parse patterns like "500g", "1.5L", "750ml", "1kg"
    const unitMatch = unitStr.match(
      /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|liter|gram|kilogram|stuks?|stuk)/i
    )
    if (unitMatch) {
      const size = unitMatch[1].replace(',', '.')
      try {
        const unitType = this.normalizeUnitType(unitMatch[2])
        return { unitSize: size, unitType }
      } catch {
        // Fall through to default
      }
    }

    // Also check the product name for unit info
    const nameStr = raw.fullTitle ?? raw.title ?? raw.name ?? ''
    const nameMatch = nameStr.match(
      /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|liter|gram|stuks?|stuk)\b/i
    )
    if (nameMatch) {
      const size = nameMatch[1].replace(',', '.')
      try {
        const unitType = this.normalizeUnitType(nameMatch[2])
        return { unitSize: size, unitType }
      } catch {
        // Fall through
      }
    }

    return { unitSize: '1', unitType: 'stuk' }
  }

  /**
   * Extract per-unit price if available (e.g. "EUR 3,98/kg").
   */
  private extractPricePerUnit(raw: LidlRawProduct): number | null {
    if (!raw.unitPrice) return null

    try {
      // Strip trailing unit indicator like "/kg", "/l", "/stuk"
      const cleaned = raw.unitPrice.replace(/\/\s*\w+$/, '').trim()
      return this.parsePrice(cleaned)
    } catch {
      return null
    }
  }
}
