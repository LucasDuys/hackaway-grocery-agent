import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PlusScraper } from '../plus-scraper'
import { RateLimiter } from '../rate-limiter'
import fixtures from './fixtures/plus-response.json'

// Mock the RateLimiter module so wait() resolves immediately
vi.mock('../rate-limiter')
vi.mocked(RateLimiter).mockImplementation(() => ({
  wait: vi.fn().mockResolvedValue(undefined),
  minDelayMs: 0,
  lastRequest: 0,
}) as unknown as RateLimiter)

function mockHtmlResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
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
    json: vi.fn(),
    bytes: vi.fn(),
  } as unknown as Response
}

describe('PlusScraper', () => {
  let scraper: PlusScraper
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scraper = new PlusScraper()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has storeSlug "plus" and storeName "Plus"', () => {
    expect(scraper.storeSlug).toBe('plus')
    expect(scraper.storeName).toBe('Plus')
  })

  it('parses products from JSON-LD with all fields populated', async () => {
    // Return category page with JSON-LD for first category, empty for the rest
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.categoryPageWithJsonLd))
    // Remaining 9 categories + bonus page all return empty
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    const result = await scraper.scrape()

    expect(result.storeSlug).toBe('plus')
    expect(result.errors).toHaveLength(0)

    // Should have 2 products from the JSON-LD page
    expect(result.products).toHaveLength(2)

    const melk = result.products[0]
    expect(melk.name).toBe('Plus Halfvolle Melk 1L')
    expect(melk.brand).toBe('Plus')
    expect(melk.ean).toBe('8711800100013')
    expect(melk.priceCents).toBe(119)
    expect(melk.unitSize).toBe('1L')
    expect(melk.unitType).toBe('L')
    expect(melk.imageUrl).toBe('https://www.plus.nl/images/melk-halfvol.jpg')
    expect(melk.categoryRaw).toBe('Vast assortiment')
    expect(melk.sourceUrl).toBe('https://www.plus.nl/producten/plus-halfvolle-melk')
    expect(melk.isOnSale).toBe(false)
    expect(melk.originalPriceCents).toBeNull()

    const kaas = result.products[1]
    expect(kaas.name).toBe('Gouda Kaas Jong 500g')
    expect(kaas.brand).toBe('Milner')
    expect(kaas.ean).toBeNull() // no gtin13 in fixture
    expect(kaas.priceCents).toBe(449)
    expect(kaas.unitSize).toBe('500g')
    expect(kaas.unitType).toBe('g')
  })

  it('handles Plus bonus pricing with isOnSale and originalPriceCents', async () => {
    // All categories return empty, bonus page has bonus product
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.bonusPageWithJsonLd))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)

    const pindakaas = result.products[0]
    expect(pindakaas.name).toBe('Pindakaas Naturel 350g')
    expect(pindakaas.brand).toBe('Calv\u00e9')
    expect(pindakaas.isOnSale).toBe(true)
    expect(pindakaas.priceCents).toBe(249)
    expect(pindakaas.originalPriceCents).toBe(329)
    expect(pindakaas.categoryRaw).toBe('Bonus')
    expect(pindakaas.ean).toBe('8711200429301')
  })

  it('falls back to HTML parsing when no JSON-LD is present', async () => {
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.categoryPageHtmlFallback))
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)

    const appelsap = result.products[0]
    expect(appelsap.name).toBe('Appelsap 1L')
    expect(appelsap.priceCents).toBe(189)
    expect(appelsap.unitSize).toBe('1L')
    expect(appelsap.unitType).toBe('L')
    expect(appelsap.imageUrl).toBe('https://www.plus.nl/images/appelsap.jpg')
    expect(appelsap.isOnSale).toBe(false)
    expect(appelsap.originalPriceCents).toBeNull()
    expect(appelsap.ean).toBeNull()
  })

  it('parses HTML bonus pricing with strikethrough original price', async () => {
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.bonusPageHtmlFallback))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)

    const koffie = result.products[0]
    expect(koffie.name).toBe('Koffie Bonen 500g')
    expect(koffie.priceCents).toBe(599)
    expect(koffie.originalPriceCents).toBe(799)
    expect(koffie.isOnSale).toBe(true)
    expect(koffie.categoryRaw).toBe('Bonus')
  })

  it('skips products with missing required fields in JSON-LD', async () => {
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.missingFieldsJsonLd))
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    const result = await scraper.scrape()

    // Only "Water Mineraal 1.5L" should parse; null name and missing price are skipped
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Water Mineraal 1.5L')
    expect(result.products[0].priceCents).toBe(59)
    expect(result.products[0].imageUrl).toBeNull()
    expect(result.products[0].ean).toBeNull()
  })

  it('handles empty results with no products and no errors', async () => {
    for (let i = 0; i < 11; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('records HTTP errors and continues to next category', async () => {
    // First category returns 500
    fetchMock.mockResolvedValueOnce(mockHtmlResponse('', 500))
    // Second category has products
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.categoryPageWithJsonLd))
    // Rest empty
    for (let i = 0; i < 9; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    // Mock withRetry to fail fast (avoid actual backoff delays in tests)
    vi.spyOn(scraper, 'withRetry').mockImplementation(async (fn) => {
      return await fn()
    })

    const result = await scraper.scrape()

    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.errors[0].phase).toBe('fetch')
    expect(result.products.length).toBeGreaterThanOrEqual(1)
  })

  it('handles invalid JSON-LD gracefully without errors', async () => {
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.invalidJsonLd))
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    const result = await scraper.scrape()

    // Invalid JSON-LD is silently skipped, no products and no errors
    expect(result.products).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('converts euro prices to integer cents correctly', async () => {
    fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.categoryPageWithJsonLd))
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(mockHtmlResponse(fixtures.emptyPage))
    }

    const result = await scraper.scrape()

    // 1.19 EUR -> 119 cents, 4.49 EUR -> 449 cents
    expect(result.products[0].priceCents).toBe(119)
    expect(result.products[1].priceCents).toBe(449)
  })

  it('returns error when network fails completely', async () => {
    vi.spyOn(scraper, 'withRetry').mockImplementation(async (fn) => {
      return await fn()
    })

    fetchMock.mockRejectedValue(new Error('Network error'))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
  })
})
