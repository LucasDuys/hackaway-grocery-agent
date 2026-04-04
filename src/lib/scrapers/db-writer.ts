import type {
  ScrapeResult,
  ScrapedProduct,
  WriteResult,
} from './types'

/** Minimal Supabase client interface for dependency injection / mocking */
export interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder
}

export interface SupabaseQueryBuilder {
  upsert(data: Record<string, unknown>, options?: { onConflict?: string }): SupabaseQueryBuilder
  update(data: Record<string, unknown>): SupabaseQueryBuilder
  insert(data: Record<string, unknown> | Record<string, unknown>[]): SupabaseQueryBuilder
  eq(column: string, value: unknown): SupabaseQueryBuilder
  select(columns?: string): SupabaseQueryBuilder
  single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
  then: Promise<{ data: unknown; error: { message: string } | null }>['then']
}

/**
 * Writes scraper results to Supabase.
 * Handles product upserts, price insertion with is_current management,
 * and optional nutrition data.
 */
export class ScraperDbWriter {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Write a complete scrape result to the database.
   * For each product:
   * 1. Upsert into products table
   * 2. Set old prices is_current = false
   * 3. Insert new price row with is_current = true
   * 4. If nutrition data exists, upsert into nutrition table
   */
  async writeResults(result: ScrapeResult): Promise<WriteResult> {
    if (result.products.length === 0) {
      return { inserted: 0, updated: 0, errors: 0 }
    }

    let inserted = 0
    let updated = 0
    let errors = 0

    for (const product of result.products) {
      try {
        // 1. Upsert product
        const productData = {
          store_slug: result.storeSlug,
          name: product.name,
          brand: product.brand,
          ean: product.ean,
          image_url: product.imageUrl,
          category_raw: product.categoryRaw,
          source_url: product.sourceUrl,
          unit_size: product.unitSize,
          unit_type: product.unitType,
          updated_at: result.scrapedAt.toISOString(),
        }

        const upsertResult = await this.supabase
          .from('products')
          .upsert(productData, { onConflict: 'store_slug,source_url' })
          .select('id')
          .single()

        if (upsertResult.error) {
          throw new Error(upsertResult.error.message)
        }

        const productId = upsertResult.data?.id

        // 2. Mark old prices as not current
        await this.supabase
          .from('prices')
          .update({ is_current: false })
          .eq('product_id', productId)
          .eq('is_current', true)

        // 3. Insert new price
        await this.supabase
          .from('prices')
          .insert({
            product_id: productId,
            price_cents: product.priceCents,
            price_per_unit_cents: product.pricePerUnitCents,
            is_on_sale: product.isOnSale,
            original_price_cents: product.originalPriceCents,
            scraped_at: result.scrapedAt.toISOString(),
            is_current: true,
          })

        // 4. Upsert nutrition if present
        if (product.nutrition) {
          await this.supabase
            .from('nutrition')
            .upsert({
              product_id: productId,
              calories_per_100g: product.nutrition.caloriesPer100g,
              protein_g: product.nutrition.proteinG,
              carbs_g: product.nutrition.carbsG,
              fat_g: product.nutrition.fatG,
              fiber_g: product.nutrition.fiberG,
              salt_g: product.nutrition.saltG,
            }, { onConflict: 'product_id' })
        }

        inserted++
      } catch (err) {
        errors++
      }
    }

    return { inserted, updated, errors }
  }

  /**
   * Log a scrape run to the scrape_logs table.
   */
  async logScrapeRun(result: ScrapeResult & { writeResult: WriteResult }): Promise<void> {
    await this.supabase
      .from('scrape_logs')
      .insert({
        store_slug: result.storeSlug,
        started_at: result.scrapedAt.toISOString(),
        duration_ms: result.durationMs,
        products_scraped: result.products.length,
        errors_count: result.errors.length,
        write_inserted: result.writeResult.inserted,
        write_errors: result.writeResult.errors,
        status: result.errors.length === 0 ? 'success' : 'partial',
      })
  }
}
