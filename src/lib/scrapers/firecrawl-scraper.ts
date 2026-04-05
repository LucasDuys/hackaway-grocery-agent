import { Firecrawl } from '@mendable/firecrawl-js'
import { z } from 'zod'
import type { ScrapedProduct, ScrapeResult, ScrapeError, UnitType } from './types'

const UNIT_MAP: Record<string, UnitType> = {
  kg: 'kg', kilogram: 'kg', kilo: 'kg',
  g: 'g', gram: 'g', gr: 'g',
  l: 'L', liter: 'L', litre: 'L',
  ml: 'ml', milliliter: 'ml',
  stuk: 'stuk', stuks: 'stuk', st: 'stuk', piece: 'stuk', pieces: 'stuk',
}

function normalizeUnit(raw: string): { unitSize: string; unitType: UnitType } {
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo|g|gram|gr|l|liter|litre|ml|milliliter|stuks?|st|pieces?)\b/i)
  if (match) {
    const unitType = UNIT_MAP[match[2].toLowerCase()] || 'stuk'
    return { unitSize: raw.trim(), unitType }
  }
  return { unitSize: raw.trim() || '1 stuk', unitType: 'stuk' }
}

interface FirecrawlProduct {
  name: string
  price_eur: number
  unit_size: string
  brand: string
  category?: string
  on_sale?: boolean
  original_price_eur?: number
  image_url?: string
}

const extractSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    price_eur: z.number(),
    unit_size: z.string(),
    brand: z.string(),
    on_sale: z.boolean().optional(),
    original_price_eur: z.number().optional(),
    image_url: z.string().optional(),
  })),
})

const EXTRACT_PROMPT = 'Extract ALL grocery products visible on this page. For each product get: name (full product name), price_eur (current price as a decimal number like 2.49), unit_size (like "1 l", "500 g", "6 stuks"), brand name, on_sale (true if discounted), original_price_eur (original price before discount, or null if not on sale), image_url (the full URL of the product image, starting with http). Be thorough -- extract every single product you can see.'

interface StoreConfig {
  slug: string
  name: string
  categoryUrls: string[]
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    slug: 'ah',
    name: 'Albert Heijn',
    categoryUrls: [
      'https://www.ah.nl/producten/1730/zuivel-eieren',
      'https://www.ah.nl/producten/6401/groente-aardappelen',
      'https://www.ah.nl/producten/20885/fruit-verse-sappen',
      'https://www.ah.nl/producten/9344/vlees',
      'https://www.ah.nl/producten/1651/vis',
      'https://www.ah.nl/producten/1355/bakkerij',
      'https://www.ah.nl/producten/6405/ontbijtgranen-beleg',
      'https://www.ah.nl/producten/1796/pasta-rijst-wereldkeuken',
      'https://www.ah.nl/producten/5881/diepvries',
      'https://www.ah.nl/producten/20824/borrel-chips-snacks',
      'https://www.ah.nl/producten/20129/koek-snoep-chocolade',
      'https://www.ah.nl/producten/6409/soepen-sauzen-kruiden-olie',
    ],
  },
  {
    slug: 'jumbo',
    name: 'Jumbo',
    categoryUrls: [
      'https://www.jumbo.com/producten/zuivel,-eieren,-boter/',
      'https://www.jumbo.com/producten/aardappelen,-groente-en-fruit/',
      'https://www.jumbo.com/producten/vlees,-vis-en-vega/',
      'https://www.jumbo.com/producten/brood-en-gebak/',
      'https://www.jumbo.com/producten/dranken/',
      'https://www.jumbo.com/producten/ontbijt,-broodbeleg-en-bakproducten/',
      'https://www.jumbo.com/producten/diepvries/',
      'https://www.jumbo.com/producten/koek,-snoep,-chocolade-en-chips/',
    ],
  },
  {
    slug: 'lidl',
    name: 'Lidl',
    categoryUrls: [
      'https://www.lidl.nl/c/assortiment-supermarkt-in-groente-en-fruit/s10080778',
      'https://www.lidl.nl/c/assortiment-supermarkt-in-vlees/s10085377',
      'https://www.lidl.nl/c/assortiment-elke-dag-vers-brood/s10008150',
      'https://www.lidl.nl/c/eten-en-drinken/s10068374',
      'https://www.lidl.nl/c/assortiment-producten/s10008015',
    ],
  },
  {
    slug: 'plus',
    name: 'Plus',
    categoryUrls: [
      'https://www.plus.nl/aanbiedingen',
      'https://www.plus.nl/producten',
    ],
  },
  {
    slug: 'aldi',
    name: 'Aldi',
    categoryUrls: [
      'https://www.aldi.nl/onze-producten.html',
      'https://www.aldi.nl/aanbiedingen.html',
    ],
  },
  {
    slug: 'picnic',
    name: 'Picnic',
    categoryUrls: [
      'https://www.picnic.app/nl/boodschappen',
    ],
  },
]

export class FirecrawlScraper {
  private client: InstanceType<typeof Firecrawl>

  constructor(apiKey?: string) {
    const key = apiKey || process.env.FIRECRAWL_API_KEY
    if (!key) throw new Error('FIRECRAWL_API_KEY is required')
    this.client = new Firecrawl({ apiKey: key })
  }

  /**
   * Scrape a single store by slug.
   */
  async scrapeStore(storeSlug: string): Promise<ScrapeResult> {
    const config = STORE_CONFIGS.find((s) => s.slug === storeSlug)
    if (!config) throw new Error(`Unknown store: ${storeSlug}`)
    return this.scrapeStoreConfig(config)
  }

  /**
   * Scrape all 6 stores sequentially.
   */
  async scrapeAll(): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = []
    for (const config of STORE_CONFIGS) {
      console.log(`\nScraping ${config.name}...`)
      const result = await this.scrapeStoreConfig(config)
      results.push(result)
      console.log(`  ${result.products.length} products, ${result.errors.length} errors (${result.durationMs}ms)`)
    }
    return results
  }

  private async scrapeStoreConfig(config: StoreConfig): Promise<ScrapeResult> {
    const start = Date.now()
    const allProducts: ScrapedProduct[] = []
    const allErrors: ScrapeError[] = []

    for (const url of config.categoryUrls) {
      try {
        const categoryName = this.extractCategoryFromUrl(url)
        console.log(`  Category: ${categoryName}...`)

        const result = await this.client.v1.scrapeUrl(url, {
          formats: ['extract'],
          extract: {
            schema: extractSchema,
            prompt: EXTRACT_PROMPT,
          },
        })

        if (!result.success) {
          allErrors.push({ url, message: 'Firecrawl returned error response', phase: 'fetch' })
          continue
        }

        const rawProducts: FirecrawlProduct[] = (result as { extract?: { products?: FirecrawlProduct[] } }).extract?.products || []

        for (const raw of rawProducts) {
          if (!raw.name || !raw.price_eur) continue

          const priceCents = Math.round(raw.price_eur * 100)
          if (priceCents <= 0) continue

          const { unitSize, unitType } = normalizeUnit(raw.unit_size || '')
          const isOnSale = raw.on_sale === true && raw.original_price_eur != null
          const originalPriceCents = isOnSale
            ? Math.round(raw.original_price_eur! * 100)
            : null

          allProducts.push({
            name: raw.name,
            brand: raw.brand || null,
            ean: null,
            priceCents,
            pricePerUnitCents: null,
            unitSize,
            unitType,
            imageUrl: raw.image_url || null,
            categoryRaw: categoryName,
            sourceUrl: url,
            isOnSale,
            originalPriceCents,
            nutrition: null,
          })
        }
      } catch (err) {
        allErrors.push({
          url,
          message: err instanceof Error ? err.message : String(err),
          phase: 'fetch',
        })
      }
    }

    return {
      storeSlug: config.slug as any,
      products: allProducts,
      errors: allErrors,
      durationMs: Date.now() - start,
      scrapedAt: new Date(),
    }
  }

  private extractCategoryFromUrl(url: string): string {
    const parts = url.split('/')
    const last = parts[parts.length - 1]
      .replace(/\.html$/, '')
      .replace(/^a\d+$/, '')
    const secondLast = parts[parts.length - 2] || ''

    const slug = last || secondLast
    return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  }
}
