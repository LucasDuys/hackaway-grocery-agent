import type { SupabaseClient } from '../scrapers/db-writer'
import type { MatchResult } from './types'
import { OpenFoodFactsClient } from './openfoodfacts'

interface ProductRow {
  id: string
  store_id: string
  name: string
  ean: string
  category: string | null
}

/**
 * Primary matching strategy: exact EAN barcode matching.
 * Products sharing the same EAN across different stores are identical products.
 */
export class EanMatcher {
  private offClient: OpenFoodFactsClient

  constructor(
    private readonly supabase: SupabaseClient,
    offClient?: OpenFoodFactsClient
  ) {
    this.offClient = offClient ?? new OpenFoodFactsClient()
  }

  /**
   * Run EAN-based matching across all products in the database.
   * Groups products by EAN, creates unified_product entries for groups
   * with 2+ products from different stores, and links them via product_mappings.
   */
  async match(): Promise<MatchResult[]> {
    const results: MatchResult[] = []

    // Fetch all products that have EAN codes
    const { data: products, error } = await this.supabase
      .from('products')
      .select('id, store_id, name, ean, category')
      .eq('is_active', true) as unknown as {
        data: ProductRow[] | null
        error: { message: string } | null
      }

    if (error || !products) {
      throw new Error(`Failed to fetch products: ${error?.message ?? 'no data'}`)
    }

    // Filter to products with EAN and group by EAN
    const eanGroups = new Map<string, ProductRow[]>()
    for (const product of products) {
      if (!product.ean) continue
      const group = eanGroups.get(product.ean) ?? []
      group.push(product)
      eanGroups.set(product.ean, group)
    }

    // Process each EAN group with 2+ products from different stores
    for (const [ean, group] of eanGroups) {
      const uniqueStores = new Set(group.map((p) => p.store_id))
      if (uniqueStores.size < 2) continue

      // Try to enrich from Open Food Facts
      let canonicalName = group[0].name
      let canonicalCategory = group[0].category ?? null
      try {
        const offProduct = await this.offClient.lookupByEan(ean)
        if (offProduct) {
          canonicalName = offProduct.name || canonicalName
          canonicalCategory = offProduct.category || canonicalCategory
        }
      } catch {
        // Enrichment is best-effort; continue with store name
      }

      // Create unified product entry
      const { data: unified, error: upsertError } = await this.supabase
        .from('unified_products')
        .upsert(
          {
            canonical_name: canonicalName,
            canonical_category: canonicalCategory,
            ean,
          },
          { onConflict: 'ean' }
        )
        .select('id')
        .single() as unknown as {
          data: { id: string } | null
          error: { message: string } | null
        }

      if (upsertError || !unified) {
        console.error(`Failed to upsert unified product for EAN ${ean}: ${upsertError?.message}`)
        continue
      }

      // Link each product to the unified product
      for (const product of group) {
        await this.supabase.from('product_mappings').upsert(
          {
            unified_product_id: unified.id,
            product_id: product.id,
            confidence_score: 1.0,
            match_method: 'exact_ean',
          },
          { onConflict: 'unified_product_id,product_id' }
        )

        results.push({
          unifiedProductId: unified.id,
          productId: product.id,
          confidence: 1.0,
          matchMethod: 'exact_ean',
        })
      }
    }

    return results
  }
}
