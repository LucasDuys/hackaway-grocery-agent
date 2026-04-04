/** Store slug identifiers for all 6 Dutch supermarkets */
export type StoreSlug = 'ah' | 'jumbo' | 'lidl' | 'picnic' | 'plus' | 'aldi'

/** Unit types for product quantities */
export type UnitType = 'kg' | 'g' | 'L' | 'ml' | 'stuk'

/** A single product scraped from a store */
export interface ScrapedProduct {
  name: string
  brand: string | null
  ean: string | null
  priceCents: number
  pricePerUnitCents: number | null
  unitSize: string
  unitType: UnitType
  imageUrl: string | null
  categoryRaw: string | null
  sourceUrl: string
  isOnSale: boolean
  originalPriceCents: number | null
  nutrition: ScrapedNutrition | null
}

/** Nutrition info scraped from a product page */
export interface ScrapedNutrition {
  caloriesPer100g: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
  saltG: number | null
}

/** Result of a complete scraper run */
export interface ScrapeResult {
  storeSlug: StoreSlug
  products: ScrapedProduct[]
  errors: ScrapeError[]
  durationMs: number
  scrapedAt: Date
}

/** An error that occurred during scraping */
export interface ScrapeError {
  url: string
  message: string
  phase: 'fetch' | 'parse' | 'write'
}

/** Options for the retry utility */
export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  isRetryable?: (error: unknown) => boolean
}

/** Options for the rate limiter */
export interface RateLimitOptions {
  minDelayMs: number
}

/** Result of a DB write operation */
export interface WriteResult {
  inserted: number
  updated: number
  errors: number
}
