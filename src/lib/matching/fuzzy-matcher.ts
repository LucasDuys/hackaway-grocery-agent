import type { SupabaseClient } from '../scrapers/db-writer'
import type { MatchResult } from './types'
import { normalizeName, normalizeUnit, nameSimilarity } from './normalizer'

interface ProductRow {
  id: string
  store_id: string
  name: string
  ean: string | null
  unit_size: string | null
  unit_type: string | null
  category: string | null
}

/** Minimum confidence to auto-match products */
const AUTO_MATCH_THRESHOLD = 0.7

/**
 * Secondary matching strategy: fuzzy name + unit size comparison.
 * Used for products that lack EAN barcodes.
 */
export class FuzzyMatcher {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Run fuzzy matching on unmatched products (those without EANs or
   * not yet linked to a unified product).
   */
  async match(): Promise<MatchResult[]> {
    const results: MatchResult[] = []

    // Fetch products that are not yet matched (no EAN)
    const { data: products, error } = await this.supabase
      .from('products')
      .select('id, store_id, name, ean, unit_size, unit_type, category')
      .eq('is_active', true) as unknown as {
        data: ProductRow[] | null
        error: { message: string } | null
      }

    if (error || !products) {
      throw new Error(`Failed to fetch products: ${error?.message ?? 'no data'}`)
    }

    // Filter to products without EAN (those with EAN should be handled by EanMatcher)
    const unmatchedProducts = products.filter((p) => !p.ean)

    // Group by store for cross-store comparison
    const byStore = new Map<string, ProductRow[]>()
    for (const product of unmatchedProducts) {
      const group = byStore.get(product.store_id) ?? []
      group.push(product)
      byStore.set(product.store_id, group)
    }

    const storeIds = Array.from(byStore.keys())
    if (storeIds.length < 2) return results

    // Track already-matched product IDs to avoid duplicates
    const matched = new Set<string>()

    // Compare products across each pair of stores
    for (let i = 0; i < storeIds.length; i++) {
      for (let j = i + 1; j < storeIds.length; j++) {
        const storeAProducts = byStore.get(storeIds[i]) ?? []
        const storeBProducts = byStore.get(storeIds[j]) ?? []

        for (const productA of storeAProducts) {
          if (matched.has(productA.id)) continue

          const normalizedA = normalizeName(productA.name)
          const unitA = productA.unit_size && productA.unit_type
            ? normalizeUnit(productA.unit_size, productA.unit_type)
            : null

          let bestMatch: { product: ProductRow; confidence: number; method: MatchResult['matchMethod'] } | null = null

          for (const productB of storeBProducts) {
            if (matched.has(productB.id)) continue

            const normalizedB = normalizeName(productB.name)
            const similarity = nameSimilarity(normalizedA, normalizedB)

            const unitB = productB.unit_size && productB.unit_type
              ? normalizeUnit(productB.unit_size, productB.unit_type)
              : null

            let confidence: number
            let method: MatchResult['matchMethod']

            if (similarity > 0.9 && unitA && unitB && unitA === unitB) {
              confidence = 0.85
              method = 'fuzzy_name_and_size'
            } else if (similarity > 0.9 && unitA && unitB && unitA !== unitB) {
              confidence = 0.6
              method = 'fuzzy_name_and_size'
            } else if (similarity > 0.8) {
              confidence = 0.5
              method = 'fuzzy_name_only'
            } else {
              continue
            }

            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { product: productB, confidence, method }
            }
          }

          // Only auto-match above the threshold
          if (bestMatch && bestMatch.confidence >= AUTO_MATCH_THRESHOLD) {
            const canonicalName = normalizeName(productA.name)
            const canonicalCategory = productA.category ?? bestMatch.product.category ?? null

            // Create unified product
            const { data: unified, error: insertError } = await this.supabase
              .from('unified_products')
              .insert({
                canonical_name: canonicalName,
                canonical_category: canonicalCategory,
              })
              .select('id')
              .single() as unknown as {
                data: { id: string } | null
                error: { message: string } | null
              }

            if (insertError || !unified) {
              console.error(`Failed to create unified product: ${insertError?.message}`)
              continue
            }

            // Link both products
            for (const product of [productA, bestMatch.product]) {
              await this.supabase.from('product_mappings').insert({
                unified_product_id: unified.id,
                product_id: product.id,
                confidence_score: bestMatch.confidence,
                match_method: bestMatch.method,
              })

              results.push({
                unifiedProductId: unified.id,
                productId: product.id,
                confidence: bestMatch.confidence,
                matchMethod: bestMatch.method,
              })
            }

            matched.add(productA.id)
            matched.add(bestMatch.product.id)
          }
        }
      }
    }

    return results
  }
}
