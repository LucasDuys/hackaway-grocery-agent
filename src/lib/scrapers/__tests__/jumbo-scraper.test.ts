import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JumboScraper } from '../jumbo-scraper'
import { RateLimiter } from '../rate-limiter'
import fixtures from './fixtures/jumbo-response.json'

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

// Single-page version of searchPage2 (total matches count so no extra pagination)
const searchPage2SinglePage = {
  products: {
    ...fixtures.searchPage2.products,
    total: 1,
    offset: 0,
    count: 1,
  },
  filters: {},
}

describe('JumboScraper', () => {
  let scraper: JumboScraper
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scraper = new JumboScraper()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has storeSlug "jumbo" and storeName "Jumbo"', () => {
    expect(scraper.storeSlug).toBe('jumbo')
    expect(scraper.storeName).toBe('Jumbo')
  })

  it('scrapes 3 products across 2 pages with all fields populated', async () => {
    // Categories fetch
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.categories))
    // Page 1 (offset=0) for first category
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))
    // Page 2 (offset=24) for first category
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage2))
    // Second category returns empty
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.emptySearch))

    const result = await scraper.scrape()

    expect(result.storeSlug).toBe('jumbo')
    expect(result.products).toHaveLength(3)
    expect(result.errors).toHaveLength(0)

    const melk = result.products[0]
    expect(melk.name).toBe('Jumbo Halfvolle Melk')
    expect(melk.brand).toBe('Jumbo')
    expect(melk.ean).toBe('8718452068654')
    expect(melk.priceCents).toBe(129)
    expect(melk.unitSize).toBe('1 liter')
    expect(melk.unitType).toBe('L')
    expect(melk.imageUrl).toBe('https://static.jumbo.com/product_images/70100001_1-360x360.png')
    expect(melk.categoryRaw).toBe('Zuivel, eieren')
    expect(melk.sourceUrl).toBe('https://www.jumbo.com/producten/jumbo-halfvolle-melk-70100001')
    expect(melk.isOnSale).toBe(false)
    expect(melk.originalPriceCents).toBeNull()
  })

  it('handles promotional pricing with isOnSale and originalPriceCents', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    // Page with promo product
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))

    const result = await scraper.scrape()

    const pindakaas = result.products[1]
    expect(pindakaas.name).toBe('Jumbo Pindakaas')
    expect(pindakaas.isOnSale).toBe(true)
    expect(pindakaas.priceCents).toBe(149)
    expect(pindakaas.originalPriceCents).toBe(199)
  })

  it('paginates correctly using offset-based pagination', async () => {
    // Use a fixture with total > PAGE_SIZE to trigger a second page fetch
    const largePage1 = {
      products: {
        ...fixtures.searchPage1.products,
        total: 25,
      },
      filters: {},
    }
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(largePage1))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage2))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const urls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(urls[1]).toContain('offset=0')
    expect(urls[2]).toContain('offset=24')
  })

  it('scrapes product with null gtins -- ean is null', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(searchPage2SinglePage))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Campina Volle Yoghurt')
    expect(result.products[0].ean).toBeNull()
  })

  it('scrapes product with empty images array -- imageUrl is null', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(searchPage2SinglePage))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].imageUrl).toBeNull()
  })

  it('records HTTP 500 as error and continues to next category', async () => {
    // Two categories
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.categories))
    // Category 1 returns 500
    fetchMock.mockResolvedValueOnce(mockResponse(null, 500))
    // Category 2 succeeds
    fetchMock.mockResolvedValueOnce(mockResponse(searchPage2SinglePage))

    const result = await scraper.scrape()

    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.products.length).toBeGreaterThanOrEqual(1)
    expect(result.products[0].name).toBe('Campina Volle Yoghurt')
  })

  it('handles empty category with no products and no errors', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.emptySearch))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('returns early with error when categories fetch fails', async () => {
    // Mock withRetry to fail fast (avoid actual backoff delays in tests)
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
  })

  it('converts integer cent prices correctly', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))

    const singleProductResponse = {
      products: {
        data: [
          {
            id: '99999',
            title: 'Test Product',
            brand: 'Test',
            category: 'Test',
            sku: '99999',
            gtins: null,
            imageInfo: { primaryView: [] },
            prices: {
              price: { currency: 'EUR', amount: 345 },
              promotionalPrice: null,
              unitPrice: null,
            },
            quantity: '1 stuk',
            link: '/producten/test-product-99999',
          },
        ],
        total: 1,
        offset: 0,
        count: 1,
      },
      filters: {},
    }
    fetchMock.mockResolvedValueOnce(mockResponse(singleProductResponse))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].priceCents).toBe(345)
  })

  it('normalizes Dutch unit types from API responses', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))

    const result = await scraper.scrape()

    expect(result.products[0].unitType).toBe('L')
    expect(result.products[1].unitType).toBe('g')
  })

  it('includes unit price from API when available', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.categories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))

    const result = await scraper.scrape()

    const melk = result.products[0]
    expect(melk.pricePerUnitCents).toBe(129)

    const pindakaas = result.products[1]
    expect(pindakaas.pricePerUnitCents).toBe(426)
  })
})
