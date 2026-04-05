import type { PriceAlert, AlertCheckResult } from './types'

/** Minimal Supabase client interface for dependency injection / mocking */
export interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder
}

export interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseQueryBuilder
  insert(values: Record<string, unknown>): SupabaseQueryBuilder
  update(values: Record<string, unknown>): SupabaseQueryBuilder
  delete(): SupabaseQueryBuilder
  eq(column: string, value: unknown): SupabaseQueryBuilder
  single(): SupabaseQueryBuilder
  then: Promise<{ data: unknown; error: { message: string } | null }>['then']
}

interface AlertRow {
  id: string
  product_id: string
  unified_product_id: string | null
  target_price_cents: number
  is_active: boolean
  triggered_at: string | null
  created_at: string
}

interface AlertWithPriceRow extends AlertRow {
  products: {
    name: string
    store_id: string
    stores: { slug: string }
  }
}

interface PriceRow {
  price_cents: number
}

function toAlert(row: AlertRow): PriceAlert {
  return {
    id: row.id,
    productId: row.product_id,
    unifiedProductId: row.unified_product_id,
    targetPriceCents: row.target_price_cents,
    isActive: row.is_active,
    triggeredAt: row.triggered_at ? new Date(row.triggered_at) : null,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Service for managing price alerts.
 * Alerts trigger when the current price of a product drops to or below
 * a user-specified target price.
 */
export class AlertService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Create a new price alert for a product.
   */
  async createAlert(
    productId: string,
    targetPriceCents: number,
    unifiedProductId?: string
  ): Promise<PriceAlert> {
    const { data, error } = await (this.supabase
      .from('price_alerts')
      .insert({
        product_id: productId,
        target_price_cents: targetPriceCents,
        unified_product_id: unifiedProductId ?? null,
      })
      .select()
      .single() as unknown as Promise<{
      data: AlertRow | null
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(`Failed to create alert: ${error.message}`)
    }

    return toAlert(data!)
  }

  /**
   * Get all alerts, optionally filtered to active-only.
   */
  async getAlerts(options?: { activeOnly?: boolean }): Promise<PriceAlert[]> {
    let query = this.supabase
      .from('price_alerts')
      .select('id, product_id, unified_product_id, target_price_cents, is_active, triggered_at, created_at')

    if (options?.activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await (query as unknown as Promise<{
      data: AlertRow[] | null
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`)
    }

    return (data ?? []).map(toAlert)
  }

  /**
   * Delete an alert by ID.
   */
  async deleteAlert(id: string): Promise<void> {
    const { error } = await (this.supabase
      .from('price_alerts')
      .delete()
      .eq('id', id) as unknown as Promise<{
      data: unknown
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(`Failed to delete alert: ${error.message}`)
    }
  }

  /**
   * Deactivate an alert (set is_active=false) without deleting it.
   */
  async deactivateAlert(id: string): Promise<void> {
    const { error } = await (this.supabase
      .from('price_alerts')
      .update({ is_active: false })
      .eq('id', id) as unknown as Promise<{
      data: unknown
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(`Failed to deactivate alert: ${error.message}`)
    }
  }

  /**
   * Check all active alerts against current prices.
   * Triggers alerts where current price <= target price.
   * Called after each scrape run.
   */
  async checkAlerts(): Promise<AlertCheckResult> {
    // 1. Get all active alerts with product info
    const { data: activeAlerts, error: alertsError } = await (this.supabase
      .from('price_alerts')
      .select('id, product_id, unified_product_id, target_price_cents, is_active, triggered_at, created_at, products(name, store_id, stores(slug))')
      .eq('is_active', true) as unknown as Promise<{
      data: AlertWithPriceRow[] | null
      error: { message: string } | null
    }>)

    if (alertsError) {
      throw new Error(`Failed to fetch active alerts: ${alertsError.message}`)
    }

    const alerts = activeAlerts ?? []
    const triggeredAlerts: PriceAlert[] = []

    // 2. For each alert, get the current price
    for (const alert of alerts) {
      const { data: priceData, error: priceError } = await (this.supabase
        .from('prices')
        .select('price_cents')
        .eq('product_id', alert.product_id)
        .eq('is_current', true)
        .single() as unknown as Promise<{
        data: PriceRow | null
        error: { message: string } | null
      }>)

      if (priceError || !priceData) {
        continue
      }

      // 3. If current price <= target, mark as triggered
      if (priceData.price_cents <= alert.target_price_cents) {
        const now = new Date().toISOString()

        const { error: updateError } = await (this.supabase
          .from('price_alerts')
          .update({ is_active: false, triggered_at: now })
          .eq('id', alert.id) as unknown as Promise<{
          data: unknown
          error: { message: string } | null
        }>)

        if (updateError) {
          continue
        }

        const triggered = toAlert(alert)
        triggered.isActive = false
        triggered.triggeredAt = new Date(now)
        triggered.productName = alert.products?.name
        triggered.currentPriceCents = priceData.price_cents
        triggered.storeSlug = alert.products?.stores?.slug

        triggeredAlerts.push(triggered)
      }
    }

    return {
      checked: alerts.length,
      triggered: triggeredAlerts.length,
      alerts: triggeredAlerts,
    }
  }
}
