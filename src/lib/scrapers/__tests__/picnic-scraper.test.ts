import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PicnicScraper } from '../picnic-scraper'
import { RateLimiter } from '../rate-limiter'
import fixtures from './fixtures/picnic-response.json'

// Mock the RateLimiter module so wait() resolves immediately
vi.mock('../rate-limiter')
vi.mocked(RateLimiter).mockImplementation(() => ({
  wait: vi.fn().mockResolvedValue(undefined),
  minDelayMs: 0,
  lastRequest: 0,
}) as unknown as RateLimiter)

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
    bytes: vi.fn(),
  } as unknown as Response
}

describe('PicnicScraper', () => {
  let scraper: PicnicScraper
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scraper = new PicnicScraper()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has storeSlug "picnic" and storeName "Picnic"', () => {
    expect(scraper.storeSlug).toBe('picnic')
    expect(scraper.storeName).toBe('Picnic')
  })

  it('has requiresAuth flag set to true', () => {
    expect(scraper.requiresAuth).toBe(true)
  })

  it('returns empty result with auth error when no token is set', async () => {
    const result = await scraper.scrape()

    expect(result.storeSlug).toBe('picnic')
    expect(result.products).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('authentication')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('scrapes products from catalog when auth token is set', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    expect(result.storeSlug).toBe('picnic')
    // 6 valid products (product-6 has no ean field but still valid, product-7 has empty name and is skipped)
    expect(result.products).toHaveLength(6)

    const melk = result.products[0]
    expect(melk.name).toBe('Picnic Halfvolle Melk')
    expect(melk.brand).toBe('Picnic')
    expect(melk.ean).toBe('8710400005568')
    expect(melk.priceCents).toBe(139)
    expect(melk.unitSize).toBe('1 L')
    expect(melk.unitType).toBe('L')
    expect(melk.imageUrl).toContain('d8a5c8a2e3e14f0b9b4f5e6a7c8d9e0f')
    expect(melk.categoryRaw).toBe('Zuivel, eieren & boter > Melk')
    expect(melk.sourceUrl).toBe('https://picnic.app/nl/product/product-1')
    expect(melk.isOnSale).toBe(true)
    expect(melk.originalPriceCents).toBe(169)
  })

  it('handles promotional pricing with PRICE_DOWN decorator', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    // Product 1 has PRICE_DOWN decorator
    const melk = result.products[0]
    expect(melk.isOnSale).toBe(true)
    expect(melk.priceCents).toBe(139)
    expect(melk.originalPriceCents).toBe(169)

    // Product 2 has no decorators
    const arla = result.products[1]
    expect(arla.isOnSale).toBe(false)
    expect(arla.originalPriceCents).toBeNull()
  })

  it('handles products with null EAN', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    // Product 3 (Scharreleieren) has null ean
    const eieren = result.products[2]
    expect(eieren.name).toBe('Picnic Scharreleieren 10 stuks')
    expect(eieren.ean).toBeNull()
  })

  it('handles products with missing ean field', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    // Product 6 (Volkoren Brood) has no ean field at all -- index 5
    const brood = result.products[5]
    expect(brood.name).toBe('Picnic Volkoren Brood')
    expect(brood.ean).toBeNull()
  })

  it('handles products with null image_id -- imageUrl is null', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    // Product 5 (Bananen) has null image_id -- index 4
    const bananen = result.products[4]
    expect(bananen.name).toBe('Bananen')
    expect(bananen.imageUrl).toBeNull()
  })

  it('skips products with empty names and records parse error', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    // Product 7 has empty name -- should be skipped
    const names = result.products.map((p) => p.name)
    expect(names).not.toContain('')

    // Error should be recorded for the empty-name product
    const parseErrors = result.errors.filter((e) => e.phase === 'parse')
    expect(parseErrors.length).toBeGreaterThanOrEqual(1)
    expect(parseErrors[0].message).toContain('no name')
  })

  it('builds correct category breadcrumb from nested structure', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    // Product in nested category
    expect(result.products[0].categoryRaw).toBe('Zuivel, eieren & boter > Melk')
    expect(result.products[2].categoryRaw).toBe('Zuivel, eieren & boter > Eieren')

    // Product in flat category
    expect(result.products[3].categoryRaw).toBe('Groente & fruit')
  })

  it('parses unit quantities correctly', () => {
    expect(scraper.parseUnitQuantity('1 L')).toEqual({ unitSize: '1 L', unitType: 'L' })
    expect(scraper.parseUnitQuantity('500 g')).toEqual({ unitSize: '500 g', unitType: 'g' })
    expect(scraper.parseUnitQuantity('10 stuks')).toEqual({ unitSize: '10 stuks', unitType: 'stuk' })
    expect(scraper.parseUnitQuantity('1 kg')).toEqual({ unitSize: '1 kg', unitType: 'kg' })

    // Composite format
    const composite = scraper.parseUnitQuantity('6 x 330 ml')
    expect(composite.unitSize).toBe('1980 ml')
    expect(composite.unitType).toBe('ml')
  })

  it('records fetch error when API call fails with auth token', async () => {
    scraper.authToken = 'test-token-123'

    // Mock withRetry to fail fast
    vi.spyOn(scraper, 'withRetry').mockImplementation(async (fn) => {
      try {
        return await fn()
      } catch (err) {
        throw err
      }
    })

    fetchMock.mockRejectedValue(new Error('Network error'))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.errors[0].phase).toBe('fetch')
  })

  it('prices are in integer cents', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    const result = await scraper.scrape()

    for (const product of result.products) {
      expect(Number.isInteger(product.priceCents)).toBe(true)
      if (product.originalPriceCents !== null) {
        expect(Number.isInteger(product.originalPriceCents)).toBe(true)
      }
    }
  })

  it('sends auth header with requests', async () => {
    scraper.authToken = 'test-token-123'
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures))

    await scraper.scrape()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const callArgs = fetchMock.mock.calls[0]
    const headers = callArgs[1]?.headers as Record<string, string>
    expect(headers['x-picnic-auth']).toBe('test-token-123')
  })
})
