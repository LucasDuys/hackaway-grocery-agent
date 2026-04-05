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
 * GET /api/products/search?q=melk&limit=20
 * Searches products from local scraped data.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')
    const limitParam = url.searchParams.get('limit')
    const storeFilter = url.searchParams.get('stores')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required query parameter: q' },
        { status: 400 },
      )
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 20
    const products = loadProducts()
    const queryLower = query.toLowerCase()

    // Filter by search query
    let results = products.filter((p) =>
      p.name.toLowerCase().includes(queryLower) ||
      (p.brand && p.brand.toLowerCase().includes(queryLower)) ||
      (p.categoryRaw && p.categoryRaw.toLowerCase().includes(queryLower))
    )

    // Filter by store
    if (storeFilter) {
      const stores = storeFilter.split(',')
      results = results.filter((p) => stores.includes(p.storeSlug))
    }

    // Group by similar product name (cross-store matching)
    const grouped = new Map<string, {
      canonicalName: string
      category: string | null
      imageUrl: string | null
      stores: Array<{
        storeSlug: string
        priceCents: number
        productName: string
        isOnSale: boolean
        originalPriceCents: number | null
        unitSize: string
        imageUrl: string | null
      }>
    }>()

    for (const p of results) {
      // Normalize name for grouping: strip brand, size info, common modifiers
      const key = p.name.toLowerCase()
        .replace(/^(ah|jumbo|lidl|plus|aldi|picnic|de zaanse hoeve|campina|optimel|zuivelmeester|danone)\s+/i, '')
        .replace(/\b(verse?|houdbare?|biologische?|voordeelverpakking)\b/gi, '')
        .replace(/\d+\s*(x\s*)?\d*\s*(g|kg|ml|l|liter|stuks?|st)\b/gi, '')
        .replace(/\d+[.,]\d+\s*(g|kg|ml|l)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Don't group if key is too short (would over-match)
      const groupKey = key.length >= 3 ? key : p.name.toLowerCase()

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          canonicalName: p.name.replace(/^(AH|Jumbo|PLUS)\s+/i, ''),
          category: p.categoryRaw,
          imageUrl: p.imageUrl,
          stores: [],
        })
      }
      // Use image from whichever product has one
      if (p.imageUrl && !grouped.get(groupKey)!.imageUrl) {
        grouped.get(groupKey)!.imageUrl = p.imageUrl
      }

      grouped.get(groupKey)!.stores.push({
        storeSlug: p.storeSlug,
        priceCents: p.priceCents,
        productName: p.name,
        isOnSale: p.isOnSale,
        originalPriceCents: p.originalPriceCents,
        unitSize: p.unitSize,
        imageUrl: p.imageUrl,
      })
    }

    // Convert to array and sort by cheapest price
    const output = [...grouped.values()]
      .map((g) => ({
        ...g,
        stores: g.stores.sort((a, b) => a.priceCents - b.priceCents),
        cheapestPriceCents: Math.min(...g.stores.map((s) => s.priceCents)),
        storeCount: new Set(g.stores.map((s) => s.storeSlug)).size,
      }))
      .sort((a, b) => a.cheapestPriceCents - b.cheapestPriceCents)
      .slice(0, limit)

    return NextResponse.json(output)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
