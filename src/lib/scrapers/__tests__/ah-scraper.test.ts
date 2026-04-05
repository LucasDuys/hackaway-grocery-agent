import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AhScraper } from '../ah-scraper'
import { RateLimiter } from '../rate-limiter'
import fixtures from './fixtures/ah-response.json'

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

// Single-page version of searchPage2 (totalPages=1 so no extra pagination fetch)
const searchPage2SinglePage = {
  ...fixtures.searchPage2,
  page: { totalPages: 1, size: 36, totalElements: 1 },
}

describe('AhScraper', () => {
  let scraper: AhScraper
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scraper = new AhScraper()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has storeSlug "ah" and storeName "Albert Heijn"', () => {
    expect(scraper.storeSlug).toBe('ah')
    expect(scraper.storeName).toBe('Albert Heijn')
  })

  it('scrapes 3 products across 2 pages with all fields populated', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.taxonomyCategories))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage2))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.emptySearch))

    const result = await scraper.scrape()

    expect(result.storeSlug).toBe('ah')
    expect(result.products).toHaveLength(3)
    expect(result.errors).toHaveLength(0)

    const melk = result.products[0]
    expect(melk.name).toBe('AH Halfvolle melk')
    expect(melk.brand).toBe('AH')
    expect(melk.ean).toBe('8710400005568')
    expect(melk.priceCents).toBe(129)
    expect(melk.unitSize).toBe('1 liter')
    expect(melk.unitType).toBe('L')
    expect(melk.imageUrl).toBe('https://static.ah.nl/dam/product/12345.jpg')
    expect(melk.categoryRaw).toBe('Zuivel, eieren')
    expect(melk.sourceUrl).toBe('https://www.ah.nl/producten/product/12345/ah-halfvolle-melk')
    expect(melk.isOnSale).toBe(false)
    expect(melk.originalPriceCents).toBeNull()
  })

  it('handles AH bonus prices with isOnSale and originalPriceCents', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage2))

    const result = await scraper.scrape()

    const pindakaas = result.products[1]
    expect(pindakaas.name).toBe('AH Pindakaas')
    expect(pindakaas.isOnSale).toBe(true)
    expect(pindakaas.priceCents).toBe(199)
    expect(pindakaas.originalPriceCents).toBe(249)
  })

  it('paginates correctly: page 0 returns more results, page 1 is last', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage2))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const urls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(urls[1]).toContain('page=0')
    expect(urls[2]).toContain('page=1')
  })

  it('scrapes product with null gtins -- ean is null', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(searchPage2SinglePage))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Campina Volle Yoghurt')
    expect(result.products[0].ean).toBeNull()
  })

  it('scrapes product with empty images array -- imageUrl is null', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(searchPage2SinglePage))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].imageUrl).toBeNull()
  })

  it('records HTTP 500 as error and continues to next category', async () => {
    // Two categories
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.taxonomyCategories))
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
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.emptySearch))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('returns early with error when taxonomy fetch fails', async () => {
    // Mock withRetry to fail fast (avoid actual backoff delays in tests)
    const origWithRetry = scraper.withRetry.bind(scraper)
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

  it('converts euro prices to integer cents correctly', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))

    const singleProductResponse = {
      cards: [
        {
          products: [
            {
              webshopId: 99999,
              title: 'Test Product',
              brand: 'Test',
              category: 'Test',
              gtins: null,
              images: [],
              price: { now: 3.45, was: null, unitSize: '1 stuk' },
              unitPriceDescription: null,
              discount: null,
              link: 'test-product',
            },
          ],
        },
      ],
      page: { totalPages: 1, size: 36, totalElements: 1 },
    }
    fetchMock.mockResolvedValueOnce(mockResponse(singleProductResponse))

    const result = await scraper.scrape()

    expect(result.products).toHaveLength(1)
    expect(result.products[0].priceCents).toBe(345)
  })

  it('normalizes Dutch unit types from API responses', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse([fixtures.taxonomyCategories[0]]))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage1))
    fetchMock.mockResolvedValueOnce(mockResponse(fixtures.searchPage2))

    const result = await scraper.scrape()

    expect(result.products[0].unitType).toBe('L')
    expect(result.products[1].unitType).toBe('g')
    expect(result.products[2].unitType).toBe('ml')
  })
})
