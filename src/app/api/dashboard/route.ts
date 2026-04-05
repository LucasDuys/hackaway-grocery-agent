import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

interface LocalProduct {
  name: string
  brand: string | null
  priceCents: number
  unitSize: string
  unitType: string
  categoryRaw: string | null
  isOnSale: boolean
  originalPriceCents: number | null
  storeSlug: string
  imageUrl: string | null
}

const STORE_NAMES: Record<string, string> = {
  ah: 'Albert Heijn',
  jumbo: 'Jumbo',
  lidl: 'Lidl',
  plus: 'Plus',
  aldi: 'Aldi',
  picnic: 'Picnic',
}

// Common basket items for store comparison
const BASKET_KEYWORDS = [
  'melk',
  'brood',
  'kaas',
  'eieren',
  'boter',
  'appel',
  'banaan',
  'yoghurt',
  'kip',
  'rijst',
]

function loadProducts(): LocalProduct[] {
  try {
    const filePath = path.join(process.cwd(), 'data', 'products.json')
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * GET /api/dashboard
 * Computes dashboard statistics from local product data.
 */
export async function GET() {
  try {
    const products = loadProducts()

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No product data available' },
        { status: 500 },
      )
    }

    // Total products
    const totalProducts = products.length

    // Store breakdown
    const storeMap = new Map<string, { totalCents: number; count: number }>()
    for (const p of products) {
      const entry = storeMap.get(p.storeSlug) || { totalCents: 0, count: 0 }
      entry.totalCents += p.priceCents
      entry.count += 1
      storeMap.set(p.storeSlug, entry)
    }

    const storeBreakdown = [...storeMap.entries()].map(([slug, data]) => ({
      storeSlug: slug,
      storeName: STORE_NAMES[slug] ?? slug,
      productCount: data.count,
      avgPriceCents: Math.round(data.totalCents / data.count),
    }))

    // Top 10 cheapest products across all stores
    const cheapestProducts = [...products]
      .sort((a, b) => a.priceCents - b.priceCents)
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        storeSlug: p.storeSlug,
        storeName: STORE_NAMES[p.storeSlug] ?? p.storeSlug,
        priceCents: p.priceCents,
        unitSize: p.unitSize,
      }))

    // Deals: products on sale, sorted by savings amount
    const deals = products
      .filter((p) => p.isOnSale && p.originalPriceCents != null && p.originalPriceCents > p.priceCents)
      .map((p) => {
        const savingsCents = p.originalPriceCents! - p.priceCents
        return {
          name: p.name,
          storeSlug: p.storeSlug,
          storeName: STORE_NAMES[p.storeSlug] ?? p.storeSlug,
          priceCents: p.priceCents,
          originalPriceCents: p.originalPriceCents!,
          savingsCents,
          savingsPercent: Math.round((savingsCents / p.originalPriceCents!) * 100),
          unitSize: p.unitSize,
        }
      })
      .sort((a, b) => b.savingsCents - a.savingsCents)

    // Store comparisons: for a sample basket of common items, calculate total at each store
    const storeSlugs = [...storeMap.keys()]
    const storeComparisons: Array<{
      storeSlug: string
      storeName: string
      totalCents: number
      itemsFound: number
      itemsMissing: number
    }> = []

    for (const slug of storeSlugs) {
      const storeProducts = products.filter((p) => p.storeSlug === slug)
      let totalCents = 0
      let itemsFound = 0

      for (const keyword of BASKET_KEYWORDS) {
        const match = storeProducts.find((p) =>
          p.name.toLowerCase().includes(keyword),
        )
        if (match) {
          totalCents += match.priceCents
          itemsFound++
        }
      }

      storeComparisons.push({
        storeSlug: slug,
        storeName: STORE_NAMES[slug] ?? slug,
        totalCents,
        itemsFound,
        itemsMissing: BASKET_KEYWORDS.length - itemsFound,
      })
    }

    storeComparisons.sort((a, b) => a.totalCents - b.totalCents)

    // Savings summary: optimized basket (cheapest per keyword across all stores) vs cheapest single store
    let optimizedTotalCents = 0
    let optimizedItemsFound = 0

    for (const keyword of BASKET_KEYWORDS) {
      const matches = products.filter((p) =>
        p.name.toLowerCase().includes(keyword),
      )
      if (matches.length > 0) {
        const cheapest = matches.reduce((a, b) =>
          a.priceCents < b.priceCents ? a : b,
        )
        optimizedTotalCents += cheapest.priceCents
        optimizedItemsFound++
      }
    }

    // Cheapest single store total (only consider stores with at least some items)
    const validComparisons = storeComparisons.filter((c) => c.itemsFound > 0)
    const cheapestSingleStoreCents = validComparisons.length > 0
      ? Math.min(...validComparisons.map((c) => c.totalCents))
      : 0

    const savingsCents = Math.max(0, cheapestSingleStoreCents - optimizedTotalCents)
    const savingsPercent = cheapestSingleStoreCents > 0
      ? Math.round((savingsCents / cheapestSingleStoreCents) * 100)
      : 0

    return NextResponse.json({
      totalProducts,
      storeBreakdown,
      cheapestProducts,
      deals,
      storeComparisons,
      savingsSummary: {
        optimizedTotalCents,
        cheapestSingleStoreCents,
        savingsCents,
        savingsPercent,
        basketSize: BASKET_KEYWORDS.length,
        optimizedItemsFound,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
