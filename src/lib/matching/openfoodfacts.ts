import { RateLimiter } from '../scrapers/rate-limiter'

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'

export interface OpenFoodFactsProduct {
  name: string
  brand: string
  category: string
}

/**
 * Client for the Open Food Facts API.
 * Rate-limited to 1 request per second (free API, no key required).
 */
export class OpenFoodFactsClient {
  private rateLimiter: RateLimiter

  constructor(rateLimiter?: RateLimiter) {
    this.rateLimiter = rateLimiter ?? new RateLimiter(1000)
  }

  /**
   * Look up a product by EAN barcode.
   * Returns canonical name, brand, and category, or null if not found.
   */
  async lookupByEan(ean: string): Promise<OpenFoodFactsProduct | null> {
    await this.rateLimiter.wait()

    try {
      const response = await fetch(`${BASE_URL}/${ean}.json`)

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      if (!data.product) {
        return null
      }

      const product = data.product
      const name = product.product_name
      const brand = product.brands
      const category = Array.isArray(product.categories_tags)
        ? product.categories_tags[0] ?? ''
        : ''

      if (!name) {
        return null
      }

      return {
        name: name ?? '',
        brand: brand ?? '',
        category,
      }
    } catch {
      return null
    }
  }
}
