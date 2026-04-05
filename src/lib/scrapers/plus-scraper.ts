import { BaseScraper } from './base-scraper'
import { RateLimiter } from './rate-limiter'
import type {
  ScrapedProduct,
  ScrapeResult,
  ScrapeError,
  UnitType,
} from './types'

/** Base URL for the Plus Netherlands website */
const PLUS_BASE_URL = 'https://www.plus.nl'

/** Category pages to scrape */
const CATEGORY_PATHS = [
  '/producten/zuivel-eieren-boter',
  '/producten/vlees-vis-vega',
  '/producten/brood-gebak',
  '/producten/groente-fruit',
  '/producten/dranken',
  '/producten/ontbijt-beleg',
  '/producten/pasta-rijst-wereldkeuken',
  '/producten/snoep-koek-chips',
  '/producten/diepvries',
  '/producten/huishouden',
]

/** Path for weekly bonus deals */
const BONUS_PATH = '/aanbiedingen'

/**
 * Scraper for Plus Netherlands (plus.nl).
 *
 * Plus is a mid-size Dutch supermarket chain. Products are extracted
 * from embedded JSON-LD where available, falling back to HTML product
 * card parsing. Plus bonus pricing is tracked via sale indicators.
 * EAN codes are extracted from JSON-LD when available.
 */
export class PlusScraper extends BaseScraper {
  readonly storeSlug = 'plus' as const
  readonly storeName = 'Plus'

  private rateLimiter = new RateLimiter(1500)

  async scrape(): Promise<ScrapeResult> {
    const start = Date.now()
    const products: ScrapedProduct[] = []
    const errors: ScrapeError[] = []

    // Scrape permanent range categories
    for (const path of CATEGORY_PATHS) {
      const url = `${PLUS_BASE_URL}${path}`
      try {
        await this.rateLimiter.wait()
        const pageProducts = await this.withRetry(
          () => this.scrapeCategoryPage(url, false),
          { maxRetries: 2, baseDelayMs: 2000 }
        )
        products.push(...pageProducts)
      } catch (error) {
        errors.push({
          url,
          message: error instanceof Error ? error.message : String(error),
          phase: 'fetch',
        })
      }
    }

    // Scrape bonus deals
    const bonusUrl = `${PLUS_BASE_URL}${BONUS_PATH}`
    try {
      await this.rateLimiter.wait()
      const bonusProducts = await this.withRetry(
        () => this.scrapeCategoryPage(bonusUrl, true),
        { maxRetries: 2, baseDelayMs: 2000 }
      )
      products.push(...bonusProducts)
    } catch (error) {
      errors.push({
        url: bonusUrl,
        message: error instanceof Error ? error.message : String(error),
        phase: 'fetch',
      })
    }

    return {
      storeSlug: 'plus',
      products,
      errors,
      durationMs: Date.now() - start,
      scrapedAt: new Date(),
    }
  }

  /**
   * Scrape a single category or bonus page for product data.
   * Tries embedded JSON-LD first, then falls back to HTML parsing.
   */
  async scrapeCategoryPage(
    url: string,
    isBonus: boolean
  ): Promise<ScrapedProduct[]> {
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

    // Try JSON-LD extraction first
    const jsonLdProducts = this.extractFromJsonLd(html, url, isBonus)
    if (jsonLdProducts.length > 0) {
      return jsonLdProducts
    }

    // Fall back to HTML card parsing
    return this.extractFromHtml(html, url, isBonus)
  }

  /**
   * Extract products from JSON-LD structured data embedded in the page.
   * Plus pages may contain schema.org Product or ItemList markup.
   */
  extractFromJsonLd(
    html: string,
    pageUrl: string,
    isBonus: boolean
  ): ScrapedProduct[] {
    const products: ScrapedProduct[] = []
    const jsonLdPattern =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let match: RegExpExecArray | null

    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1])
        const items = this.flattenJsonLd(data)

        for (const item of items) {
          if (item['@type'] !== 'Product') continue

          const product = this.jsonLdToProduct(item, pageUrl, isBonus)
          if (product) {
            products.push(product)
          }
        }
      } catch {
        // Invalid JSON-LD block, skip it
      }
    }

    return products
  }

  /**
   * Flatten JSON-LD data that may be a single object, an array,
   * or an ItemList containing individual product entries.
   */
  private flattenJsonLd(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) {
      return data.flatMap((item) => this.flattenJsonLd(item))
    }

    if (typeof data !== 'object' || data === null) {
      return []
    }

    const obj = data as Record<string, unknown>

    // If it's an ItemList, extract the listElements
    if (obj['@type'] === 'ItemList' && Array.isArray(obj['itemListElement'])) {
      return (obj['itemListElement'] as Record<string, unknown>[]).flatMap(
        (el) => {
          if (el['item'] && typeof el['item'] === 'object') {
            return [el['item'] as Record<string, unknown>]
          }
          return [el]
        }
      )
    }

    return [obj]
  }

  /**
   * Convert a JSON-LD Product object into a ScrapedProduct.
   * Returns null if required fields (name, price) are missing.
   */
  private jsonLdToProduct(
    item: Record<string, unknown>,
    pageUrl: string,
    isBonus: boolean
  ): ScrapedProduct | null {
    const name = typeof item['name'] === 'string' ? item['name'] : null
    if (!name) return null

    // Extract price from offers
    const offers = item['offers'] as Record<string, unknown> | undefined
    let priceRaw: string | null = null

    if (offers) {
      if (typeof offers['price'] === 'number') {
        priceRaw = String(offers['price'])
      } else if (typeof offers['price'] === 'string') {
        priceRaw = offers['price']
      }
    }

    if (!priceRaw) return null

    let priceCents: number
    try {
      const priceNum = parseFloat(priceRaw)
      if (isNaN(priceNum)) return null
      priceCents = Math.round(priceNum * 100)
    } catch {
      return null
    }

    const imageUrl =
      typeof item['image'] === 'string'
        ? item['image']
        : Array.isArray(item['image']) && typeof item['image'][0] === 'string'
          ? item['image'][0]
          : null

    const brand =
      typeof item['brand'] === 'object' &&
      item['brand'] !== null &&
      typeof (item['brand'] as Record<string, unknown>)['name'] === 'string'
        ? ((item['brand'] as Record<string, unknown>)['name'] as string)
        : typeof item['brand'] === 'string'
          ? item['brand']
          : null

    // Extract EAN from gtin13 or gtin field
    let ean: string | null = null
    if (typeof item['gtin13'] === 'string' && this.validateEan(item['gtin13'])) {
      ean = item['gtin13']
    } else if (typeof item['gtin'] === 'string' && this.validateEan(item['gtin'])) {
      ean = item['gtin']
    }

    const sourceUrl =
      typeof item['url'] === 'string' ? item['url'] : pageUrl

    // Check for original price in offers (bonus pricing)
    let originalPriceCents: number | null = null
    let isOnSale = isBonus
    if (offers && typeof offers['highPrice'] === 'number') {
      originalPriceCents = Math.round((offers['highPrice'] as number) * 100)
      isOnSale = true
    } else if (offers && typeof offers['highPrice'] === 'string') {
      const hp = parseFloat(offers['highPrice'] as string)
      if (!isNaN(hp) && hp > 0) {
        originalPriceCents = Math.round(hp * 100)
        isOnSale = true
      }
    }

    const categoryLabel = isBonus ? 'Bonus' : 'Vast assortiment'
    const { unitSize, unitType } = this.parseUnitFromName(name)

    return {
      name,
      brand,
      ean,
      priceCents,
      pricePerUnitCents: null,
      unitSize,
      unitType,
      imageUrl,
      categoryRaw: categoryLabel,
      sourceUrl,
      isOnSale,
      originalPriceCents,
      nutrition: null,
    }
  }

  /**
   * Extract products from HTML product cards when JSON-LD is not available.
   * Looks for common Plus card patterns with product name, price, and image.
   */
  extractFromHtml(
    html: string,
    pageUrl: string,
    isBonus: boolean
  ): ScrapedProduct[] {
    const products: ScrapedProduct[] = []

    // Pattern for product cards
    const cardPattern =
      /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
    let match: RegExpExecArray | null

    while ((match = cardPattern.exec(html)) !== null) {
      const card = match[0]
      const product = this.parseProductCard(card, pageUrl, isBonus)
      if (product) {
        products.push(product)
      }
    }

    return products
  }

  /**
   * Parse a single HTML product card into a ScrapedProduct.
   * Returns null if required data cannot be extracted.
   */
  parseProductCard(
    cardHtml: string,
    pageUrl: string,
    isBonus: boolean
  ): ScrapedProduct | null {
    // Extract product name
    const nameMatch = cardHtml.match(
      /<(?:h[2-4]|span|a)[^>]*class="[^"]*(?:product[_-]?(?:name|title)|title)[^"]*"[^>]*>([^<]+)</i
    )
    if (!nameMatch) return null
    const name = nameMatch[1].trim()
    if (!name) return null

    // Extract price - look for price elements (exclude old/original/was/strikethrough price classes)
    const priceMatch = cardHtml.match(
      /(?:data-price=["']([^"']+)["']|class="(?![^"]*(?:old|original|was|strikethrough))[^"]*price[^"]*"[^>]*>(?:€\s*)?(\d+[.,]\d{2}))/i
    )
    if (!priceMatch) return null

    const priceRaw = priceMatch[1] || priceMatch[2]
    let priceCents: number
    try {
      if (priceMatch[1]) {
        const num = parseFloat(priceMatch[1])
        if (isNaN(num)) return null
        priceCents = Math.round(num * 100)
      } else {
        priceCents = this.parsePrice(priceRaw)
      }
    } catch {
      return null
    }

    // Extract image URL
    const imgMatch = cardHtml.match(
      /(?:data-src|src)=["'](https?:\/\/[^"']+(?:\.jpg|\.png|\.webp)[^"']*)/i
    )
    const imageUrl = imgMatch ? imgMatch[1] : null

    // Extract link
    const linkMatch = cardHtml.match(/href=["']([^"']*product[^"']*)/i)
    const sourceUrl = linkMatch
      ? linkMatch[1].startsWith('http')
        ? linkMatch[1]
        : `${PLUS_BASE_URL}${linkMatch[1]}`
      : pageUrl

    // Check for original (strikethrough) price indicating a bonus deal
    const originalPriceMatch = cardHtml.match(
      /class="[^"]*(?:old|original|was|strikethrough)[^"]*"[^>]*>(?:€\s*)?(\d+[.,]\d{2})/i
    )
    let originalPriceCents: number | null = null
    let isOnSale = isBonus
    if (originalPriceMatch) {
      try {
        originalPriceCents = this.parsePrice(originalPriceMatch[1])
        isOnSale = true
      } catch {
        // Ignore parse failures for original price
      }
    }

    const categoryLabel = isBonus ? 'Bonus' : 'Vast assortiment'
    const { unitSize, unitType } = this.parseUnitFromName(name)

    return {
      name,
      brand: null,
      ean: null,
      priceCents,
      pricePerUnitCents: null,
      unitSize,
      unitType,
      imageUrl,
      categoryRaw: categoryLabel,
      sourceUrl,
      isOnSale,
      originalPriceCents,
      nutrition: null,
    }
  }

  /**
   * Attempt to extract unit size and type from the product name.
   * E.g. "Halfvolle melk 1L" -> { unitSize: "1L", unitType: "L" }
   * Falls back to "1 stuk" / "stuk" if no pattern matches.
   */
  parseUnitFromName(name: string): { unitSize: string; unitType: UnitType } {
    const unitPattern =
      /(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo|g|gram|l|liter|litre|ml|milliliter|millilitre|stuks?|st)\b/i
    const match = name.match(unitPattern)

    if (match) {
      const quantity = match[1]
      const rawUnit = match[2]
      try {
        const unitType = this.normalizeUnitType(rawUnit)
        return {
          unitSize: `${quantity}${rawUnit}`.replace(/\s+/g, ''),
          unitType,
        }
      } catch {
        // Unknown unit, fall through to default
      }
    }

    return { unitSize: '1 stuk', unitType: 'stuk' }
  }
}
