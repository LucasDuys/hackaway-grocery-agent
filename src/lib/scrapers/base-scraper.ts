import type {
  StoreSlug,
  UnitType,
  ScrapeResult,
  RetryOptions,
  RateLimitOptions,
} from './types'

/**
 * Abstract base class for all Dutch supermarket scrapers.
 * Provides shared utilities: price parsing, unit normalization,
 * EAN validation, retry logic, and rate limiting.
 */
export abstract class BaseScraper {
  abstract readonly storeSlug: StoreSlug
  abstract readonly storeName: string

  /** Execute the full scrape for this store */
  abstract scrape(): Promise<ScrapeResult>

  /**
   * Parse a Dutch-format price string into integer cents.
   * Handles formats: "EUR 2,49", "2,49", "1,-", "gratis", "0,05"
   * Also handles thousands separator: "1.249,99" -> 124999
   * Throws on empty or unparseable strings.
   */
  parsePrice(raw: string): number {
    const trimmed = raw.trim()
    if (!trimmed) {
      throw new Error(`Cannot parse empty price string`)
    }

    // "gratis" -> 0
    if (trimmed.toLowerCase() === 'gratis') {
      return 0
    }

    // Strip currency prefix
    let cleaned = trimmed
      .replace(/^EUR\s*/i, '')
      .replace(/^€\s*/, '')
      .trim()

    // Handle "1,-" format (whole euros, no cents)
    if (cleaned.endsWith(',-')) {
      const euros = parseInt(cleaned.replace(',-', ''), 10)
      if (isNaN(euros)) {
        throw new Error(`Cannot parse price: "${raw}"`)
      }
      return euros * 100
    }

    // Remove thousands separators (dots before comma)
    // e.g. "1.249,99" -> "1249,99"
    cleaned = cleaned.replace(/\./g, '')

    // Replace comma with dot for parseFloat
    cleaned = cleaned.replace(',', '.')

    const value = parseFloat(cleaned)
    if (isNaN(value)) {
      throw new Error(`Cannot parse price: "${raw}"`)
    }

    return Math.round(value * 100)
  }

  /**
   * Normalize a Dutch unit type string to a standard UnitType.
   * e.g. "kilogram" -> "kg", "liter" -> "L", "stuks" -> "stuk"
   */
  normalizeUnitType(raw: string): UnitType {
    const lower = raw.trim().toLowerCase()

    const mapping: Record<string, UnitType> = {
      kg: 'kg',
      kilogram: 'kg',
      kilo: 'kg',
      g: 'g',
      gram: 'g',
      l: 'L',
      liter: 'L',
      litre: 'L',
      ml: 'ml',
      milliliter: 'ml',
      millilitre: 'ml',
      stuk: 'stuk',
      stuks: 'stuk',
      'per stuk': 'stuk',
      st: 'stuk',
    }

    const result = mapping[lower]
    if (!result) {
      throw new Error(`Unknown unit type: "${raw}"`)
    }
    return result
  }

  /**
   * Validate an EAN barcode (EAN-8 or EAN-13).
   * Checks length, numeric content, and check digit.
   */
  validateEan(ean: string): boolean {
    if (!/^\d+$/.test(ean)) {
      return false
    }

    if (ean.length !== 8 && ean.length !== 13) {
      return false
    }

    // Validate check digit
    const digits = ean.split('').map(Number)
    const checkDigit = digits[digits.length - 1]
    const payload = digits.slice(0, -1)

    let sum = 0
    if (ean.length === 13) {
      for (let i = 0; i < payload.length; i++) {
        sum += payload[i] * (i % 2 === 0 ? 1 : 3)
      }
    } else {
      // EAN-8
      for (let i = 0; i < payload.length; i++) {
        sum += payload[i] * (i % 2 === 0 ? 3 : 1)
      }
    }

    const calculated = (10 - (sum % 10)) % 10
    return calculated === checkDigit
  }

  /**
   * Retry a function with exponential backoff.
   * Throws after maxRetries failed attempts.
   * If isRetryable is provided, non-retryable errors are thrown immediately.
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = { maxRetries: 3, baseDelayMs: 1000 }
  ): Promise<T> {
    const { maxRetries, baseDelayMs, isRetryable } = options
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        // If error is not retryable, throw immediately
        if (isRetryable && !isRetryable(error)) {
          throw error
        }

        // If we've used all retries, throw
        if (attempt === maxRetries) {
          throw lastError
        }

        // Exponential backoff
        const delay = baseDelayMs * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError
  }

  /**
   * Rate limiter that ensures minimum delay between calls.
   * Returns a function that wraps the original with rate limiting.
   */
  createRateLimiter(options: RateLimitOptions): <T>(fn: () => Promise<T>) => Promise<T> {
    let lastCallTime = 0

    return async <T>(fn: () => Promise<T>): Promise<T> => {
      const now = Date.now()
      const elapsed = now - lastCallTime
      const remaining = options.minDelayMs - elapsed

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }

      lastCallTime = Date.now()
      return fn()
    }
  }
}
