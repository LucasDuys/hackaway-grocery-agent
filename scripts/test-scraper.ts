/**
 * Quick CLI script to test scrapers without Supabase.
 * Usage: npx tsx scripts/test-scraper.ts [store]
 *
 * Examples:
 *   npx tsx scripts/test-scraper.ts ah
 *   npx tsx scripts/test-scraper.ts jumbo
 *   npx tsx scripts/test-scraper.ts lidl
 *   npx tsx scripts/test-scraper.ts all
 */

import { AhScraper } from '../src/lib/scrapers/ah-scraper'
import { JumboScraper } from '../src/lib/scrapers/jumbo-scraper'
import { LidlScraper } from '../src/lib/scrapers/lidl-scraper'
import { PicnicScraper } from '../src/lib/scrapers/picnic-scraper'
import { PlusScraper } from '../src/lib/scrapers/plus-scraper'
import { AldiScraper } from '../src/lib/scrapers/aldi-scraper'
import type { ScrapeResult } from '../src/lib/scrapers/types'

const scrapers = {
  ah: () => new AhScraper(),
  jumbo: () => new JumboScraper(),
  lidl: () => new LidlScraper(),
  picnic: () => new PicnicScraper(),
  plus: () => new PlusScraper(),
  aldi: () => new AldiScraper(),
}

function formatPrice(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`
}

function printResult(result: ScrapeResult) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${result.storeSlug.toUpperCase()} -- ${result.products.length} products, ${result.errors.length} errors, ${result.durationMs}ms`)
  console.log(`${'='.repeat(60)}`)

  if (result.products.length === 0) {
    console.log('  No products scraped.')
    if (result.errors.length > 0) {
      console.log('\n  Errors:')
      result.errors.slice(0, 5).forEach((e) => {
        console.log(`    - ${e.phase}: ${e.message}`)
        console.log(`      URL: ${e.url}`)
      })
    }
    return
  }

  // Show first 15 products
  const preview = result.products.slice(0, 15)
  console.log('')
  preview.forEach((p, i) => {
    const sale = p.isOnSale ? ` (was ${formatPrice(p.originalPriceCents!)})` : ''
    const ean = p.ean ? ` [EAN: ${p.ean}]` : ''
    console.log(`  ${String(i + 1).padStart(2)}. ${p.name}`)
    console.log(`      ${formatPrice(p.priceCents)}${sale} -- ${p.unitSize} ${p.unitType}${ean}`)
    if (p.brand) console.log(`      Brand: ${p.brand}`)
    if (p.categoryRaw) console.log(`      Category: ${p.categoryRaw}`)
    console.log('')
  })

  if (result.products.length > 15) {
    console.log(`  ... and ${result.products.length - 15} more products`)
  }

  // Stats
  const withEan = result.products.filter((p) => p.ean !== null).length
  const onSale = result.products.filter((p) => p.isOnSale).length
  const avgPrice = Math.round(result.products.reduce((s, p) => s + p.priceCents, 0) / result.products.length)
  const categories = new Set(result.products.map((p) => p.categoryRaw).filter(Boolean))

  console.log(`\n  Stats:`)
  console.log(`    Products with EAN: ${withEan}/${result.products.length}`)
  console.log(`    On sale: ${onSale}`)
  console.log(`    Average price: ${formatPrice(avgPrice)}`)
  console.log(`    Categories: ${categories.size}`)

  if (result.errors.length > 0) {
    console.log(`\n  Errors (${result.errors.length}):`)
    result.errors.slice(0, 3).forEach((e) => {
      console.log(`    - ${e.phase}: ${e.message.slice(0, 80)}`)
    })
    if (result.errors.length > 3) {
      console.log(`    ... and ${result.errors.length - 3} more`)
    }
  }
}

async function main() {
  const arg = process.argv[2]?.toLowerCase() || 'ah'

  if (arg === 'all') {
    console.log('Scraping all 6 stores (this may take a few minutes)...\n')
    for (const [slug, create] of Object.entries(scrapers)) {
      console.log(`Starting ${slug}...`)
      try {
        const scraper = create()
        const result = await scraper.scrape()
        printResult(result)
      } catch (err) {
        console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } else if (arg in scrapers) {
    console.log(`Scraping ${arg}...`)
    const scraper = scrapers[arg as keyof typeof scrapers]()
    const result = await scraper.scrape()
    printResult(result)
  } else {
    console.log(`Unknown store: ${arg}`)
    console.log(`Available: ${Object.keys(scrapers).join(', ')}, all`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
