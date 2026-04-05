import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AldiScraper } from '../aldi-scraper'

describe('AldiScraper', () => {
  let scraper: AldiScraper

  beforeEach(() => {
    scraper = new AldiScraper()
  })

  // ---------------------------------------------------------------------------
  // Basic properties
  // ---------------------------------------------------------------------------
  it('has storeSlug "aldi"', () => {
    expect(scraper.storeSlug).toBe('aldi')
  })

  it('has storeName "Aldi"', () => {
    expect(scraper.storeName).toBe('Aldi')
  })

  // ---------------------------------------------------------------------------
  // JSON-LD extraction
  // ---------------------------------------------------------------------------
  describe('extractFromJsonLd', () => {
    it('extracts a product from a JSON-LD Product block', () => {
      const html = `
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Product",
            "name": "Halfvolle melk 1L",
            "image": "https://cdn.aldi.nl/melk.jpg",
            "brand": { "@type": "Brand", "name": "Milsani" },
            "offers": {
              "@type": "Offer",
              "price": 1.09,
              "priceCurrency": "EUR"
            },
            "url": "https://www.aldi.nl/producten/halfvolle-melk.html"
          }
          </script>
        </head>
        <body></body>
        </html>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl/producten/zuivel', false)

      expect(products).toHaveLength(1)
      expect(products[0].name).toBe('Halfvolle melk 1L')
      expect(products[0].priceCents).toBe(109)
      expect(products[0].brand).toBe('Milsani')
      expect(products[0].imageUrl).toBe('https://cdn.aldi.nl/melk.jpg')
      expect(products[0].sourceUrl).toBe('https://www.aldi.nl/producten/halfvolle-melk.html')
      expect(products[0].ean).toBeNull()
      expect(products[0].nutrition).toBeNull()
      expect(products[0].categoryRaw).toBe('Vast assortiment')
      expect(products[0].isOnSale).toBe(false)
    })

    it('extracts products from a JSON-LD ItemList', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "ItemList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "item": {
                "@type": "Product",
                "name": "Pindakaas 350g",
                "offers": { "price": "1.99", "priceCurrency": "EUR" }
              }
            },
            {
              "@type": "ListItem",
              "item": {
                "@type": "Product",
                "name": "Hagelslag 400g",
                "offers": { "price": 1.49 }
              }
            }
          ]
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl/producten', false)
      expect(products).toHaveLength(2)
      expect(products[0].name).toBe('Pindakaas 350g')
      expect(products[0].priceCents).toBe(199)
      expect(products[1].name).toBe('Hagelslag 400g')
      expect(products[1].priceCents).toBe(149)
    })

    it('flags weekly specials with correct category and isOnSale', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Ribeye steak 300g",
          "offers": { "price": 4.99 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl/aanbiedingen', true)

      expect(products).toHaveLength(1)
      expect(products[0].categoryRaw).toBe('Weekaanbiedingen')
      expect(products[0].isOnSale).toBe(true)
    })

    it('flags permanent range products correctly', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Boter 250g",
          "offers": { "price": 2.19 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl/producten/zuivel', false)

      expect(products).toHaveLength(1)
      expect(products[0].categoryRaw).toBe('Vast assortiment')
      expect(products[0].isOnSale).toBe(false)
    })

    it('returns empty array for invalid JSON-LD', () => {
      const html = `
        <script type="application/ld+json">
        { this is not valid json }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(0)
    })

    it('skips JSON-LD entries that are not Products', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "name": "Home" }
          ]
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(0)
    })

    it('skips products without a name', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "offers": { "price": 1.99 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(0)
    })

    it('skips products without a price', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Mystery item"
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(0)
    })

    it('handles brand as a plain string', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Kaas 500g",
          "brand": "Hofburger",
          "offers": { "price": 3.49 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(1)
      expect(products[0].brand).toBe('Hofburger')
    })

    it('handles image as an array', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Brood 800g",
          "image": ["https://cdn.aldi.nl/brood1.jpg", "https://cdn.aldi.nl/brood2.jpg"],
          "offers": { "price": 1.29 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(1)
      expect(products[0].imageUrl).toBe('https://cdn.aldi.nl/brood1.jpg')
    })

    it('uses page URL as sourceUrl when product has no url field', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Appels 1kg",
          "offers": { "price": 2.49 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl/producten/groente-fruit', false)
      expect(products[0].sourceUrl).toBe('https://www.aldi.nl/producten/groente-fruit')
    })
  })

  // ---------------------------------------------------------------------------
  // HTML card extraction
  // ---------------------------------------------------------------------------
  describe('extractFromHtml', () => {
    it('extracts a product from an HTML card with product-name class', () => {
      const html = `
        <div class="product-card">
          <a href="/producten/volle-melk.html">
            <img src="https://cdn.aldi.nl/melk.jpg" />
            <span class="product-name">Volle melk 1L</span>
            <span class="price">1,19</span>
          </a>
        </div></div>
      `
      const products = scraper.extractFromHtml(html, 'https://www.aldi.nl/producten/zuivel', false)
      expect(products).toHaveLength(1)
      expect(products[0].name).toBe('Volle melk 1L')
      expect(products[0].priceCents).toBe(119)
      expect(products[0].ean).toBeNull()
      expect(products[0].nutrition).toBeNull()
    })

    it('detects original price from strikethrough element', () => {
      const html = `
        <div class="product-card">
          <span class="product-title">Sinaasappelsap 1L</span>
          <span class="old-price">2,49</span>
          <span class="price">1,99</span>
        </div></div>
      `
      const products = scraper.extractFromHtml(html, 'https://www.aldi.nl/aanbiedingen', true)
      expect(products).toHaveLength(1)
      expect(products[0].priceCents).toBe(199)
      expect(products[0].originalPriceCents).toBe(249)
      expect(products[0].isOnSale).toBe(true)
    })

    it('returns empty array when no cards are found', () => {
      const html = '<html><body><p>No products here</p></body></html>'
      const products = scraper.extractFromHtml(html, 'https://www.aldi.nl', false)
      expect(products).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // parseProductCard
  // ---------------------------------------------------------------------------
  describe('parseProductCard', () => {
    it('returns null when card has no product name', () => {
      const card = `
        <div class="product-card">
          <span class="price">1,99</span>
        </div></div>
      `
      const result = scraper.parseProductCard(card, 'https://www.aldi.nl', false)
      expect(result).toBeNull()
    })

    it('returns null when card has no price', () => {
      const card = `
        <div class="product-card">
          <span class="product-name">Some item</span>
        </div></div>
      `
      const result = scraper.parseProductCard(card, 'https://www.aldi.nl', false)
      expect(result).toBeNull()
    })

    it('extracts data-price attribute', () => {
      const card = `
        <div class="product-item" data-price="3.49">
          <h3 class="product-name">Yoghurt 500g</h3>
          <img data-src="https://cdn.aldi.nl/yoghurt.webp" />
          <a href="/producten/yoghurt-detail.html">Details</a>
        </div></div>
      `
      const result = scraper.parseProductCard(card, 'https://www.aldi.nl', false)
      expect(result).not.toBeNull()
      expect(result!.priceCents).toBe(349)
      expect(result!.imageUrl).toBe('https://cdn.aldi.nl/yoghurt.webp')
    })

    it('constructs absolute URL from relative link', () => {
      const card = `
        <div class="product-item">
          <span class="product-name">Chips 200g</span>
          <span class="price">1,49</span>
          <a href="/producten/chips-detail.html">Details</a>
        </div></div>
      `
      const result = scraper.parseProductCard(card, 'https://www.aldi.nl/producten', false)
      expect(result).not.toBeNull()
      expect(result!.sourceUrl).toBe('https://www.aldi.nl/producten/chips-detail.html')
    })
  })

  // ---------------------------------------------------------------------------
  // parseUnitFromName
  // ---------------------------------------------------------------------------
  describe('parseUnitFromName', () => {
    it('extracts "1L" from product name', () => {
      const result = scraper.parseUnitFromName('Halfvolle melk 1L')
      expect(result.unitType).toBe('L')
      expect(result.unitSize).toBe('1L')
    })

    it('extracts "500g" from product name', () => {
      const result = scraper.parseUnitFromName('Pindakaas 500g')
      expect(result.unitType).toBe('g')
      expect(result.unitSize).toBe('500g')
    })

    it('extracts "1.5 liter" with space', () => {
      const result = scraper.parseUnitFromName('Sinaasappelsap 1.5 liter')
      expect(result.unitType).toBe('L')
      expect(result.unitSize).toBe('1.5liter')
    })

    it('extracts "250 ml" pattern', () => {
      const result = scraper.parseUnitFromName('Slagroom 250 ml')
      expect(result.unitType).toBe('ml')
      expect(result.unitSize).toBe('250ml')
    })

    it('extracts "6 stuks" pattern', () => {
      const result = scraper.parseUnitFromName('Eieren 6 stuks')
      expect(result.unitType).toBe('stuk')
      expect(result.unitSize).toBe('6stuks')
    })

    it('extracts "1kg" pattern', () => {
      const result = scraper.parseUnitFromName('Aardappelen 1kg')
      expect(result.unitType).toBe('kg')
      expect(result.unitSize).toBe('1kg')
    })

    it('defaults to "1 stuk" when no unit found', () => {
      const result = scraper.parseUnitFromName('Broodje kroket')
      expect(result.unitType).toBe('stuk')
      expect(result.unitSize).toBe('1 stuk')
    })
  })

  // ---------------------------------------------------------------------------
  // Price extraction (integer cents)
  // ---------------------------------------------------------------------------
  describe('price extraction as integer cents', () => {
    it('stores price from JSON-LD as integer cents', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Kaas plakken 200g",
          "offers": { "price": 1.89 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products[0].priceCents).toBe(189)
      expect(Number.isInteger(products[0].priceCents)).toBe(true)
    })

    it('handles sub-euro prices correctly', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Komkommer",
          "offers": { "price": 0.69 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products[0].priceCents).toBe(69)
    })
  })

  // ---------------------------------------------------------------------------
  // Missing EAN / nutrition handled gracefully
  // ---------------------------------------------------------------------------
  describe('missing EAN and nutrition', () => {
    it('always sets ean to null for Aldi products', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Boter 250g",
          "offers": { "price": 2.19 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products[0].ean).toBeNull()
    })

    it('always sets nutrition to null for Aldi products', () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Yoghurt 500g",
          "offers": { "price": 0.89 }
        }
        </script>
      `
      const products = scraper.extractFromJsonLd(html, 'https://www.aldi.nl', false)
      expect(products[0].nutrition).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Error recovery in scrape()
  // ---------------------------------------------------------------------------
  describe('error recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('captures fetch errors without crashing the full scrape', async () => {
      // Mock fetch to always fail
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', mockFetch)

      // Run scrape -- it should complete (not throw) even though all fetches fail
      const resultPromise = scraper.scrape()

      // Advance timers to handle rate limiter waits and retry delays
      // Each category: rate limit wait + 3 attempts (1 initial + 2 retries) with exponential backoff
      for (let i = 0; i < 50; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      const result = await resultPromise

      expect(result.storeSlug).toBe('aldi')
      expect(result.products).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].phase).toBe('fetch')
      expect(result.errors[0].message).toContain('Network error')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(result.scrapedAt).toBeInstanceOf(Date)

      vi.unstubAllGlobals()
    })

    it('collects products from successful pages even when some pages fail', async () => {
      let callCount = 0
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        callCount++
        // Fail the first category, succeed the second
        if (url.includes('zuivel')) {
          return Promise.reject(new Error('Timeout'))
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(`
              <script type="application/ld+json">
              { "@type": "Product", "name": "Brood 800g", "offers": { "price": 1.29 } }
              </script>
            `),
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const resultPromise = scraper.scrape()

      for (let i = 0; i < 80; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      const result = await resultPromise

      // Should have errors from failed pages
      expect(result.errors.length).toBeGreaterThan(0)
      // Should still have products from successful pages
      expect(result.products.length).toBeGreaterThan(0)

      vi.unstubAllGlobals()
    })

    it('handles HTTP error responses gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      })
      vi.stubGlobal('fetch', mockFetch)

      const resultPromise = scraper.scrape()

      for (let i = 0; i < 80; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      const result = await resultPromise

      expect(result.products).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('403')

      vi.unstubAllGlobals()
    })
  })

  // ---------------------------------------------------------------------------
  // ScrapeResult structure
  // ---------------------------------------------------------------------------
  describe('ScrapeResult structure', () => {
    it('returns a valid ScrapeResult with all required fields', async () => {
      vi.useFakeTimers()

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>No products</body></html>'),
      })
      vi.stubGlobal('fetch', mockFetch)

      const resultPromise = scraper.scrape()

      for (let i = 0; i < 50; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      const result = await resultPromise

      expect(result).toHaveProperty('storeSlug', 'aldi')
      expect(result).toHaveProperty('products')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('durationMs')
      expect(result).toHaveProperty('scrapedAt')
      expect(Array.isArray(result.products)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(typeof result.durationMs).toBe('number')
      expect(result.scrapedAt).toBeInstanceOf(Date)

      vi.unstubAllGlobals()
      vi.useRealTimers()
    })
  })
})
