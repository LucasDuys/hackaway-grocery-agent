import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseScraper } from '../base-scraper'
import type { ScrapeResult } from '../types'

/**
 * Minimal concrete subclass of BaseScraper for testing utility methods.
 */
class TestScraper extends BaseScraper {
  readonly storeSlug = 'ah' as const
  readonly storeName = 'Test Store'

  async scrape(): Promise<ScrapeResult> {
    return {
      storeSlug: 'ah',
      products: [],
      errors: [],
      durationMs: 0,
      scrapedAt: new Date(),
    }
  }
}

describe('BaseScraper', () => {
  let scraper: TestScraper

  beforeEach(() => {
    scraper = new TestScraper()
  })

  // ---------------------------------------------------------------------------
  // parsePrice
  // ---------------------------------------------------------------------------
  describe('parsePrice', () => {
    it('parses "EUR 2,49" to 249 cents', () => {
      expect(scraper.parsePrice('€ 2,49')).toBe(249)
    })

    it('parses bare "2,49" to 249 cents', () => {
      expect(scraper.parsePrice('2,49')).toBe(249)
    })

    it('parses "EUR 1,99" with text prefix to 199 cents', () => {
      expect(scraper.parsePrice('EUR 1,99')).toBe(199)
    })

    it('parses "EUR 12,00" to 1200 cents', () => {
      expect(scraper.parsePrice('€ 12,00')).toBe(1200)
    })

    it('parses "1,-" whole-euro format to 100 cents', () => {
      expect(scraper.parsePrice('1,-')).toBe(100)
    })

    it('parses "0,99" to 99 cents', () => {
      expect(scraper.parsePrice('0,99')).toBe(99)
    })

    it('parses "EUR 0,05" to 5 cents', () => {
      expect(scraper.parsePrice('€ 0,05')).toBe(5)
    })

    it('parses "gratis" to 0 cents', () => {
      expect(scraper.parsePrice('gratis')).toBe(0)
    })

    it('throws on empty string', () => {
      expect(() => scraper.parsePrice('')).toThrow()
    })

    it('throws on non-numeric string "abc"', () => {
      expect(() => scraper.parsePrice('abc')).toThrow()
    })

    it('parses "EUR 1.249,99" with thousands separator to 124999 cents', () => {
      expect(scraper.parsePrice('€ 1.249,99')).toBe(124999)
    })

    it('handles whitespace-only string as empty', () => {
      expect(() => scraper.parsePrice('   ')).toThrow()
    })

    it('is case-insensitive for "GRATIS"', () => {
      expect(scraper.parsePrice('GRATIS')).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // normalizeUnitType
  // ---------------------------------------------------------------------------
  describe('normalizeUnitType', () => {
    it('normalizes "kilogram" to "kg"', () => {
      expect(scraper.normalizeUnitType('kilogram')).toBe('kg')
    })

    it('normalizes "liter" to "L"', () => {
      expect(scraper.normalizeUnitType('liter')).toBe('L')
    })

    it('normalizes "stuks" to "stuk"', () => {
      expect(scraper.normalizeUnitType('stuks')).toBe('stuk')
    })

    it('normalizes "gram" to "g"', () => {
      expect(scraper.normalizeUnitType('gram')).toBe('g')
    })

    it('normalizes "milliliter" to "ml"', () => {
      expect(scraper.normalizeUnitType('milliliter')).toBe('ml')
    })

    it('passes through "stuk" unchanged', () => {
      expect(scraper.normalizeUnitType('stuk')).toBe('stuk')
    })

    it('passes through "kg" unchanged', () => {
      expect(scraper.normalizeUnitType('kg')).toBe('kg')
    })

    it('normalizes "per stuk" to "stuk"', () => {
      expect(scraper.normalizeUnitType('per stuk')).toBe('stuk')
    })

    it('handles leading/trailing whitespace', () => {
      expect(scraper.normalizeUnitType('  kilogram  ')).toBe('kg')
    })

    it('throws on unknown unit type', () => {
      expect(() => scraper.normalizeUnitType('bushel')).toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // validateEan
  // ---------------------------------------------------------------------------
  describe('validateEan', () => {
    it('validates a correct EAN-13 (8710400005568)', () => {
      // Check digit calculation for 871040000556:
      // Positions: 1*8 + 3*7 + 1*1 + 3*0 + 1*4 + 3*0 + 1*0 + 3*0 + 1*0 + 3*5 + 1*5 + 3*6
      //          = 8+21+1+0+4+0+0+0+0+15+5+18 = 72, (10 - 72%10)%10 = (10-2)%10 = 8
      expect(scraper.validateEan('8710400005568')).toBe(true)
    })

    it('validates a correct EAN-8 (96385074)', () => {
      // EAN-8 check digit for 9638507:
      // Weights (EAN-8): 3,1,3,1,3,1,3
      // 3*9 + 1*6 + 3*3 + 1*8 + 3*5 + 1*0 + 3*7 = 27+6+9+8+15+0+21 = 86
      // (10 - 86%10)%10 = (10-6)%10 = 4
      expect(scraper.validateEan('96385074')).toBe(true)
    })

    it('validates all zeros as technically valid EAN-13', () => {
      // 0000000000000: all weights * 0 = 0, check = (10-0)%10 = 0
      expect(scraper.validateEan('0000000000000')).toBe(true)
    })

    it('rejects EAN-13 with incorrect check digit', () => {
      // Change last digit of a valid EAN
      expect(scraper.validateEan('8710400005569')).toBe(false)
    })

    it('rejects a string that is too short', () => {
      expect(scraper.validateEan('123')).toBe(false)
    })

    it('rejects an empty string', () => {
      expect(scraper.validateEan('')).toBe(false)
    })

    it('rejects non-numeric characters', () => {
      expect(scraper.validateEan('abcdefghijklm')).toBe(false)
    })

    it('rejects a 12-digit string (wrong length)', () => {
      expect(scraper.validateEan('871040000556')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // withRetry
  // ---------------------------------------------------------------------------
  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('returns the result when function succeeds on first try', async () => {
      const fn = vi.fn().mockResolvedValue('ok')
      const promise = scraper.withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })

      const result = await promise
      expect(result).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries and returns result after transient failures', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const promise = scraper.withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })

      // Advance through the two retry delays
      await vi.advanceTimersByTimeAsync(10) // first retry delay (10ms * 2^0)
      await vi.advanceTimersByTimeAsync(20) // second retry delay (10ms * 2^1)

      const result = await promise
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('throws after exhausting all retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'))

      const promise = scraper.withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })
      // Prevent unhandled rejection warning
      promise.catch(() => {})

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(10)  // delay after attempt 0
      await vi.advanceTimersByTimeAsync(20)  // delay after attempt 1
      await vi.advanceTimersByTimeAsync(40)  // delay after attempt 2

      await expect(promise).rejects.toThrow('always fails')
      expect(fn).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    })

    it('throws immediately for non-retryable errors without retrying', async () => {
      const nonRetryableError = new Error('auth failed')
      const fn = vi.fn().mockRejectedValue(nonRetryableError)

      const isRetryable = (err: unknown) =>
        err instanceof Error && err.message !== 'auth failed'

      const promise = scraper.withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        isRetryable,
      })

      await expect(promise).rejects.toThrow('auth failed')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    afterEach(() => {
      vi.useRealTimers()
    })
  })

  // ---------------------------------------------------------------------------
  // createRateLimiter
  // ---------------------------------------------------------------------------
  describe('createRateLimiter', () => {
    it('delays the second call by at least minDelayMs', async () => {
      vi.useFakeTimers()

      const rateLimited = scraper.createRateLimiter({ minDelayMs: 100 })
      const fn = vi.fn().mockResolvedValue('ok')

      // First call should go through immediately
      const first = rateLimited(fn)
      await vi.advanceTimersByTimeAsync(0)
      await first

      // Second call should be delayed
      const start = Date.now()
      const secondPromise = rateLimited(fn)
      await vi.advanceTimersByTimeAsync(100)
      await secondPromise
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(fn).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('does not delay when enough time has passed since last call', async () => {
      vi.useFakeTimers()

      const rateLimited = scraper.createRateLimiter({ minDelayMs: 50 })
      const fn = vi.fn().mockResolvedValue('ok')

      // First call
      await rateLimited(fn)

      // Advance past the minimum delay
      await vi.advanceTimersByTimeAsync(100)

      // Second call should not need extra delay
      const start = Date.now()
      await rateLimited(fn)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(50)
      expect(fn).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })
})
