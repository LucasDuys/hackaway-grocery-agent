/**
 * Full scrape of all Dutch supermarkets via Firecrawl.
 * Saves results to data/scrape-results.json for local testing.
 *
 * Usage:
 *   npx tsx scripts/scrape-all.ts           # scrape all 6 stores
 *   npx tsx scripts/scrape-all.ts ah jumbo  # scrape specific stores
 */

import { FirecrawlScraper } from '../src/lib/scrapers/firecrawl-scraper'
import * as fs from 'fs'
import * as path from 'path'

function formatPrice(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`
}

async function main() {
  const args = process.argv.slice(2)
  const scraper = new FirecrawlScraper()

  console.log('='.repeat(60))
  console.log('  Dutch Grocery Optimizer -- Full Scrape')
  console.log('='.repeat(60))

  let results

  if (args.length > 0) {
    console.log(`\nScraping stores: ${args.join(', ')}`)
    results = []
    for (const slug of args) {
      try {
        const result = await scraper.scrapeStore(slug)
        results.push(result)
      } catch (err) {
        console.error(`Failed to scrape ${slug}:`, err instanceof Error ? err.message : String(err))
      }
    }
  } else {
    console.log('\nScraping all 6 stores (this takes a few minutes)...')
    results = await scraper.scrapeAll()
  }

  // Save raw results
  const dataDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const outputPath = path.join(dataDir, 'scrape-results.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\nRaw results saved to ${outputPath}`)

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('  SUMMARY')
  console.log('='.repeat(60))

  let totalProducts = 0
  let totalErrors = 0

  for (const result of results) {
    totalProducts += result.products.length
    totalErrors += result.errors.length

    console.log(`\n  ${result.storeSlug.toUpperCase()} (${result.products.length} products, ${result.errors.length} errors, ${(result.durationMs / 1000).toFixed(1)}s)`)

    if (result.products.length > 0) {
      // Show top 5 cheapest
      const sorted = [...result.products].sort((a, b) => a.priceCents - b.priceCents)
      console.log('    Cheapest:')
      sorted.slice(0, 3).forEach((p) => {
        console.log(`      ${formatPrice(p.priceCents)} -- ${p.name} (${p.unitSize})`)
      })

      // Show categories
      const categories = new Set(result.products.map((p) => p.categoryRaw).filter(Boolean))
      console.log(`    Categories: ${[...categories].join(', ')}`)

      // Stats
      const avgPrice = Math.round(result.products.reduce((s, p) => s + p.priceCents, 0) / result.products.length)
      const onSale = result.products.filter((p) => p.isOnSale).length
      console.log(`    Avg price: ${formatPrice(avgPrice)} | On sale: ${onSale}`)
    }

    if (result.errors.length > 0) {
      console.log('    Errors:')
      result.errors.slice(0, 2).forEach((e) => {
        console.log(`      ${e.phase}: ${e.message.slice(0, 60)}`)
      })
    }
  }

  console.log('\n' + '-'.repeat(60))
  console.log(`  TOTAL: ${totalProducts} products, ${totalErrors} errors`)
  console.log('-'.repeat(60))

  // Cross-store comparison for common products
  if (results.length >= 2) {
    console.log('\n' + '='.repeat(60))
    console.log('  CROSS-STORE PRICE COMPARISON (sample)')
    console.log('='.repeat(60))

    // Find products with similar names across stores
    const productsByName = new Map<string, Array<{ store: string; price: number; name: string }>>()

    for (const result of results) {
      for (const product of result.products) {
        // Normalize name for matching
        const key = product.name.toLowerCase()
          .replace(/^(ah|jumbo|lidl|plus|aldi|picnic)\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 30)

        if (!productsByName.has(key)) {
          productsByName.set(key, [])
        }
        productsByName.get(key)!.push({
          store: result.storeSlug,
          price: product.priceCents,
          name: product.name,
        })
      }
    }

    // Show products found at 2+ stores
    const multiStore = [...productsByName.entries()]
      .filter(([, entries]) => {
        const stores = new Set(entries.map((e) => e.store))
        return stores.size >= 2
      })
      .slice(0, 10)

    if (multiStore.length > 0) {
      for (const [, entries] of multiStore) {
        const sorted = entries.sort((a, b) => a.price - b.price)
        const cheapest = sorted[0]
        const expensive = sorted[sorted.length - 1]
        const savings = expensive.price - cheapest.price

        console.log(`\n  ${cheapest.name}`)
        sorted.forEach((e) => {
          const tag = e === cheapest ? ' << CHEAPEST' : ''
          console.log(`    ${e.store.toUpperCase().padEnd(8)} ${formatPrice(e.price)}${tag}`)
        })
        if (savings > 0) {
          console.log(`    Save ${formatPrice(savings)} by buying at ${cheapest.store.toUpperCase()}`)
        }
      }
    } else {
      console.log('\n  (No exact matches found across stores -- fuzzy matching needed)')
    }
  }

  console.log('\n\nDone. Run `npm run dev` to see the app with this data.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
