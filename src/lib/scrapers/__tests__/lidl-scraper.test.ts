import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LidlScraper } from '../lidl-scraper'

/**
 * Build a minimal HTML page with __NEXT_DATA__ containing product data.
 */
function buildNextDataHtml(products: unknown[]): string {
  const nextData = {
    props: {
      pageProps: {
        catalog: {
          items: products,
        },
      },
    },
  }
  return `
    <html><head>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
    </head><body></body></html>
  `
}

/**
 * Build an HTML page with JSON-LD product data.
 */
function buildJsonLdHtml(products: unknown[]): string {
  const scripts = products
    .map((p) => `<script type="application/ld+json">${JSON.stringify(p)}</script>`)
    .join('\n')
  return `<html><head>${scripts}</head><body></body></html>`
}

/**
 * Build an HTML page with inline catalog JSON.
 */
function buildCatalogHtml(catalog: unknown): string {
  return `
    <html><head>
    <script>window.__CATALOG__ = ${JSON.stringify(catalog)};</script>
    </head><body></body></html>
  `
}

describe('LidlScraper', () => {
  let scraper: LidlScraper

  beforeEach(() => {
    scraper = new LidlScraper()
  })

  // ---------------------------------------------------------------------------
  // Basic properties
  // ---------------------------------------------------------------------------
  describe('store identity', () => {
    it('has storeSlug "lidl"', () => {
      expect(scraper.storeSlug).toBe('lidl')
    })

    it('has storeName "Lidl"', () => {
      expect(scraper.storeName).toBe('Lidl')
    })
  })

  // ---------------------------------------------------------------------------
  // extractProductsFromHtml
  // ---------------------------------------------------------------------------
  describe('extractProductsFromHtml', () => {
    it('extracts products from __NEXT_DATA__', () => {
      const html = buildNextDataHtml([
        {
          fullTitle: 'Gouda Jong 48+',
          price: { price: 3.49 },
          image: 'https://lidl.nl/img/gouda.jpg',
          category: 'kaas',
        },
        {
          title: 'Halfvolle Melk 1L',
          price: { price: 1.15 },
          category: 'zuivel',
        },
      ])

      const products = scraper.extractProductsFromHtml(html)
      expect(products).toHaveLength(2)
      expect(products[0].fullTitle).toBe('Gouda Jong 48+')
      expect(products[1].title).toBe('Halfvolle Melk 1L')
    })

    it('extracts products from JSON-LD', () => {
      const html = buildJsonLdHtml([
        {
          '@type': 'Product',
          name: 'Pindakaas',
          offers: { price: '2.29', priceCurrency: 'EUR' },
          image: 'https://lidl.nl/img/pindakaas.jpg',
          url: '/p/pindakaas/p12345',
        },
      ])

      const products = scraper.extractProductsFromHtml(html)
      expect(products).toHaveLength(1)
      expect(products[0].fullTitle).toBe('Pindakaas')
    })

    it('extracts products from inline catalog JSON', () => {
      const html = buildCatalogHtml({
        items: [
          {
            name: 'Appelsap',
            price: { price: 0.99 },
            category: 'dranken',
          },
        ],
      })

      const products = scraper.extractProductsFromHtml(html)
      expect(products).toHaveLength(1)
      expect(products[0].name).toBe('Appelsap')
    })

    it('returns empty array for HTML with no product data', () => {
      const html = '<html><body><p>No products here</p></body></html>'
      const products = scraper.extractProductsFromHtml(html)
      expect(products).toHaveLength(0)
    })

    it('handles malformed __NEXT_DATA__ gracefully', () => {
      const html = '<html><head><script id="__NEXT_DATA__" type="application/json">{invalid json</script></head></html>'
      const products = scraper.extractProductsFromHtml(html)
      expect(products).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // parseProduct - successful parsing
  // ---------------------------------------------------------------------------
  describe('parseProduct', () => {
    it('parses a permanent range product with numeric price', () => {
      const raw = {
        fullTitle: 'Gouda Jong 48+ 400g',
        price: { price: 3.49 },
        image: 'https://lidl.nl/img/gouda.jpg',
        category: 'kaas',
        unit: '400g',
        unitPrice: '€ 8,73/kg',
        canonicalUrl: '/p/gouda-jong/p10001',
      }

      const result = scraper.parseProduct(raw, '/c/kaas/s10018', false)

      expect(result).not.toBeNull()
      expect(result!.name).toBe('Gouda Jong 48+ 400g')
      expect(result!.priceCents).toBe(349)
      expect(result!.unitSize).toBe('400')
      expect(result!.unitType).toBe('g')
      expect(result!.imageUrl).toBe('https://lidl.nl/img/gouda.jpg')
      expect(result!.categoryRaw).toBe('kaas')
      expect(result!.isOnSale).toBe(false)
      expect(result!.originalPriceCents).toBeNull()
      expect(result!.ean).toBeNull()
      expect(result!.brand).toBeNull()
      expect(result!.sourceUrl).toBe('https://www.lidl.nl/p/gouda-jong/p10001')
      expect(result!.pricePerUnitCents).toBe(873)
    })

    it('parses a weekly special with old price', () => {
      const raw = {
        fullTitle: 'Kipfilet 500g',
        price: { price: 3.99, oldPrice: 5.49 },
        image: 'https://lidl.nl/img/kipfilet.jpg',
        category: 'vlees',
        unit: '500g',
      }

      const result = scraper.parseProduct(raw, '/c/aanbiedingen/s10001', true)

      expect(result).not.toBeNull()
      expect(result!.name).toBe('Kipfilet 500g')
      expect(result!.priceCents).toBe(399)
      expect(result!.isOnSale).toBe(true)
      expect(result!.originalPriceCents).toBe(549)
      expect(result!.categoryRaw).toContain('[aanbiedingen]')
      expect(result!.categoryRaw).toContain('vlees')
    })

    it('flags product as on sale when it has oldPrice even in permanent range', () => {
      const raw = {
        fullTitle: 'Wasmiddel 1.5L',
        price: { price: 4.99, oldPrice: 6.99 },
        category: 'huishouden',
        unit: '1.5L',
      }

      const result = scraper.parseProduct(raw, '/c/huishouden/s10027', false)

      expect(result).not.toBeNull()
      expect(result!.isOnSale).toBe(true)
      expect(result!.originalPriceCents).toBe(699)
      expect(result!.categoryRaw).toBe('huishouden')
    })

    it('uses category path as fallback when product has no category', () => {
      const raw = {
        fullTitle: 'Brood Volkoren',
        price: { price: 1.29 },
      }

      const result = scraper.parseProduct(raw, '/c/brood-banket/s10021', false)

      expect(result).not.toBeNull()
      expect(result!.categoryRaw).toBe('/c/brood-banket/s10021')
    })
  })

  // ---------------------------------------------------------------------------
  // Price extraction
  // ---------------------------------------------------------------------------
  describe('price extraction', () => {
    it('converts euro float to integer cents', () => {
      const raw = { fullTitle: 'Test', price: { price: 2.49 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.priceCents).toBe(249)
    })

    it('handles zero price', () => {
      const raw = { fullTitle: 'Gratis Item', price: { price: 0 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.priceCents).toBe(0)
    })

    it('handles prices that cause floating point issues (e.g. 1.10)', () => {
      const raw = { fullTitle: 'Test', price: { price: 1.10 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.priceCents).toBe(110)
    })

    it('returns null for product with no price data', () => {
      const raw = { fullTitle: 'No Price Product' }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result).toBeNull()
    })

    it('returns null for product with undefined price', () => {
      const raw = { fullTitle: 'Bad Price', price: {} }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result).toBeNull()
    })

    it('extracts per-unit price from formatted string', () => {
      const raw = {
        fullTitle: 'Boter 250g',
        price: { price: 2.19 },
        unitPrice: '€ 8,76/kg',
      }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.pricePerUnitCents).toBe(876)
    })

    it('returns null pricePerUnit when unitPrice is missing', () => {
      const raw = { fullTitle: 'Test', price: { price: 1.00 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.pricePerUnitCents).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Missing EAN (most products)
  // ---------------------------------------------------------------------------
  describe('missing EAN handling', () => {
    it('always sets ean to null', () => {
      const raw = {
        fullTitle: 'Any Product',
        price: { price: 1.99 },
        productId: 'P12345',
      }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.ean).toBeNull()
    })

    it('does not confuse productId with ean', () => {
      const raw = {
        fullTitle: 'Another Product',
        price: { price: 2.99 },
        productId: '8710400005568',
      }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.ean).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Weekly specials vs permanent range
  // ---------------------------------------------------------------------------
  describe('weekly specials vs permanent range', () => {
    it('marks specials page products as on sale with [aanbiedingen] in category', () => {
      const raw = {
        fullTitle: 'Aanbieding Kaas',
        price: { price: 1.99 },
        category: 'kaas',
      }
      const result = scraper.parseProduct(raw, '/c/aanbiedingen/s10001', true)

      expect(result!.isOnSale).toBe(true)
      expect(result!.categoryRaw).toBe('[aanbiedingen] kaas')
    })

    it('marks permanent range products without old price as not on sale', () => {
      const raw = {
        fullTitle: 'Permanent Item',
        price: { price: 3.49 },
        category: 'zuivel',
      }
      const result = scraper.parseProduct(raw, '/c/zuivel/s10017', false)

      expect(result!.isOnSale).toBe(false)
      expect(result!.categoryRaw).toBe('zuivel')
    })

    it('specials products without old price are still marked as on sale', () => {
      const raw = {
        fullTitle: 'Weekly Deal',
        price: { price: 0.99 },
      }
      const result = scraper.parseProduct(raw, '/c/aanbiedingen/s10001', true)

      expect(result!.isOnSale).toBe(true)
      expect(result!.originalPriceCents).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Unit info extraction
  // ---------------------------------------------------------------------------
  describe('unit info extraction', () => {
    it('extracts grams from unit field', () => {
      const raw = { fullTitle: 'Chips', price: { price: 1.49 }, unit: '200g' }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.unitSize).toBe('200')
      expect(result!.unitType).toBe('g')
    })

    it('extracts liters from unit field', () => {
      const raw = { fullTitle: 'Melk', price: { price: 1.15 }, unit: '1L' }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.unitSize).toBe('1')
      expect(result!.unitType).toBe('L')
    })

    it('extracts kg from unit field', () => {
      const raw = { fullTitle: 'Aardappelen', price: { price: 1.99 }, unit: '2.5kg' }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.unitSize).toBe('2.5')
      expect(result!.unitType).toBe('kg')
    })

    it('extracts ml from unit field', () => {
      const raw = { fullTitle: 'Yoghurt', price: { price: 0.89 }, unit: '500ml' }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.unitSize).toBe('500')
      expect(result!.unitType).toBe('ml')
    })

    it('falls back to extracting from product name', () => {
      const raw = { fullTitle: 'Halfvolle Melk 1L', price: { price: 1.15 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.unitSize).toBe('1')
      expect(result!.unitType).toBe('L')
    })

    it('defaults to "1 stuk" when no unit info is available', () => {
      const raw = { fullTitle: 'Brood', price: { price: 1.29 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.unitSize).toBe('1')
      expect(result!.unitType).toBe('stuk')
    })
  })

  // ---------------------------------------------------------------------------
  // Empty / missing data handling
  // ---------------------------------------------------------------------------
  describe('empty and missing data handling', () => {
    it('returns null for product with no name', () => {
      const raw = { price: { price: 1.99 } }
      const result = scraper.parseProduct(raw as any, '/c/test', false)
      expect(result).toBeNull()
    })

    it('returns null for product with empty name', () => {
      const raw = { fullTitle: '', price: { price: 1.99 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result).toBeNull()
    })

    it('handles missing image gracefully', () => {
      const raw = { fullTitle: 'No Image', price: { price: 0.99 } }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.imageUrl).toBeNull()
    })

    it('handles missing category gracefully', () => {
      const raw = { fullTitle: 'No Category', price: { price: 0.99 } }
      const result = scraper.parseProduct(raw, '/c/dranken/s10022', false)
      expect(result!.categoryRaw).toBe('/c/dranken/s10022')
    })

    it('handles absolute canonical URL', () => {
      const raw = {
        fullTitle: 'Test',
        price: { price: 1.00 },
        canonicalUrl: 'https://www.lidl.nl/p/test/p999',
      }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.sourceUrl).toBe('https://www.lidl.nl/p/test/p999')
    })

    it('handles relative canonical URL', () => {
      const raw = {
        fullTitle: 'Test',
        price: { price: 1.00 },
        canonicalUrl: '/p/test/p999',
      }
      const result = scraper.parseProduct(raw, '/c/test', false)
      expect(result!.sourceUrl).toBe('https://www.lidl.nl/p/test/p999')
    })

    it('uses category URL as fallback source URL', () => {
      const raw = { fullTitle: 'Test', price: { price: 1.00 } }
      const result = scraper.parseProduct(raw, '/c/zuivel/s10017', false)
      expect(result!.sourceUrl).toBe('https://www.lidl.nl/c/zuivel/s10017')
    })
  })

  // ---------------------------------------------------------------------------
  // Error recovery on page load failures (scrape method)
  // ---------------------------------------------------------------------------
  describe('scrape - error recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('collects errors without crashing when fetch fails for some categories', async () => {
      let callCount = 0
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        callCount++
        const urlStr = typeof url === 'string' ? url : url.toString()

        // First category succeeds with one product
        if (urlStr.includes('zuivel')) {
          const html = buildNextDataHtml([
            { fullTitle: 'Melk 1L', price: { price: 1.15 }, category: 'zuivel' },
          ])
          return new Response(html, { status: 200 })
        }

        // All others fail
        return new Response('Server Error', { status: 500 })
      })

      const scrapePromise = scraper.scrape()

      // Advance through all rate limiter waits and retry delays
      // Each category: rate limit wait (1500ms) + potential retries (2 retries * 2000ms base)
      for (let i = 0; i < 60; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      const result = await scrapePromise

      // Should have at least one product from the successful zuivel category
      expect(result.products.length).toBeGreaterThanOrEqual(1)
      expect(result.products[0].name).toBe('Melk 1L')

      // Should have errors for failed categories
      expect(result.errors.length).toBeGreaterThan(0)

      // Result should have proper structure
      expect(result.storeSlug).toBe('lidl')
      expect(result.scrapedAt).toBeInstanceOf(Date)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('returns empty products with errors when all fetches fail', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response('Service Unavailable', { status: 503 })
      })

      const scrapePromise = scraper.scrape()

      for (let i = 0; i < 60; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      const result = await scrapePromise

      expect(result.products).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.storeSlug).toBe('lidl')
    })
  })

  // ---------------------------------------------------------------------------
  // scrapeCategory - mocked fetch
  // ---------------------------------------------------------------------------
  describe('scrapeCategory', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('fetches and parses products from a category page', async () => {
      const html = buildNextDataHtml([
        {
          fullTitle: 'Eieren 10 stuks',
          price: { price: 2.39 },
          image: 'https://lidl.nl/img/eieren.jpg',
          category: 'zuivel-eieren',
          unit: '10stuks',
        },
      ])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(html, { status: 200 })
      )

      const products = await scraper.scrapeCategory('/c/zuivel-eieren/s10017', false)

      expect(products).toHaveLength(1)
      expect(products[0].name).toBe('Eieren 10 stuks')
      expect(products[0].priceCents).toBe(239)
    })

    it('throws on non-200 HTTP response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Not Found', { status: 404 })
      )

      await expect(
        scraper.scrapeCategory('/c/nonexistent/s99999', false)
      ).rejects.toThrow('HTTP 404')
    })

    it('returns empty array when page has no products', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('<html><body>Empty page</body></html>', { status: 200 })
      )

      const products = await scraper.scrapeCategory('/c/empty/s00000', false)
      expect(products).toHaveLength(0)
    })

    it('filters out products with missing names', async () => {
      const html = buildNextDataHtml([
        { price: { price: 1.99 } },
        { fullTitle: 'Valid Product', price: { price: 2.49 } },
      ])

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(html, { status: 200 })
      )

      const products = await scraper.scrapeCategory('/c/test/s10000', false)
      expect(products).toHaveLength(1)
      expect(products[0].name).toBe('Valid Product')
    })
  })
})
