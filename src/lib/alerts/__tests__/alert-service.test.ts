import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertService } from '../alert-service'
import type { SupabaseClient, SupabaseQueryBuilder } from '../alert-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: {
  data: unknown
  error: { message: string } | null
}): SupabaseQueryBuilder {
  const builder: SupabaseQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: undefined as unknown as Promise<unknown>['then'],
  }

  ;(builder as Record<string, unknown>).then = (
    resolve: (val: unknown) => void,
    reject?: (err: unknown) => void
  ) => {
    return Promise.resolve(resolvedValue).then(resolve, reject)
  }

  return builder
}

function createMockSupabase(
  fromHandler: (table: string) => SupabaseQueryBuilder
): SupabaseClient {
  return {
    from: vi.fn(fromHandler),
  }
}

const ALERT_ROW = {
  id: 'alert-1',
  product_id: 'prod-1',
  unified_product_id: null,
  target_price_cents: 200,
  is_active: true,
  triggered_at: null,
  created_at: '2026-04-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlertService', () => {
  // -------------------------------------------------------------------------
  // createAlert
  // -------------------------------------------------------------------------
  describe('createAlert', () => {
    it('inserts with correct fields and returns alert', async () => {
      const builder = createMockQueryBuilder({
        data: ALERT_ROW,
        error: null,
      })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      const alert = await service.createAlert('prod-1', 200)

      expect(supabase.from).toHaveBeenCalledWith('price_alerts')
      expect(builder.insert).toHaveBeenCalledWith({
        product_id: 'prod-1',
        target_price_cents: 200,
        unified_product_id: null,
      })
      expect(alert.id).toBe('alert-1')
      expect(alert.productId).toBe('prod-1')
      expect(alert.targetPriceCents).toBe(200)
      expect(alert.isActive).toBe(true)
      expect(alert.triggeredAt).toBeNull()
      expect(alert.createdAt).toBeInstanceOf(Date)
    })

    it('passes unifiedProductId when provided', async () => {
      const builder = createMockQueryBuilder({
        data: { ...ALERT_ROW, unified_product_id: 'unified-1' },
        error: null,
      })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      const alert = await service.createAlert('prod-1', 200, 'unified-1')

      expect(builder.insert).toHaveBeenCalledWith({
        product_id: 'prod-1',
        target_price_cents: 200,
        unified_product_id: 'unified-1',
      })
      expect(alert.unifiedProductId).toBe('unified-1')
    })

    it('throws on DB error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'insert failed' },
      })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await expect(service.createAlert('prod-1', 200)).rejects.toThrow(
        'Failed to create alert: insert failed'
      )
    })
  })

  // -------------------------------------------------------------------------
  // getAlerts
  // -------------------------------------------------------------------------
  describe('getAlerts', () => {
    it('returns all alerts', async () => {
      const rows = [
        ALERT_ROW,
        { ...ALERT_ROW, id: 'alert-2', is_active: false, triggered_at: '2026-04-02T00:00:00Z' },
      ]
      const builder = createMockQueryBuilder({ data: rows, error: null })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      const alerts = await service.getAlerts()

      expect(alerts).toHaveLength(2)
      expect(alerts[0].id).toBe('alert-1')
      expect(alerts[1].id).toBe('alert-2')
      expect(alerts[1].isActive).toBe(false)
      expect(alerts[1].triggeredAt).toBeInstanceOf(Date)
    })

    it('respects activeOnly filter', async () => {
      const builder = createMockQueryBuilder({ data: [ALERT_ROW], error: null })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await service.getAlerts({ activeOnly: true })

      expect(builder.eq).toHaveBeenCalledWith('is_active', true)
    })

    it('does not filter when activeOnly is false', async () => {
      const builder = createMockQueryBuilder({ data: [], error: null })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await service.getAlerts({ activeOnly: false })

      expect(builder.eq).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // deleteAlert
  // -------------------------------------------------------------------------
  describe('deleteAlert', () => {
    it('removes from DB', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await service.deleteAlert('alert-1')

      expect(supabase.from).toHaveBeenCalledWith('price_alerts')
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'alert-1')
    })

    it('throws on DB error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'delete failed' },
      })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await expect(service.deleteAlert('alert-1')).rejects.toThrow(
        'Failed to delete alert: delete failed'
      )
    })
  })

  // -------------------------------------------------------------------------
  // deactivateAlert
  // -------------------------------------------------------------------------
  describe('deactivateAlert', () => {
    it('sets is_active to false', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await service.deactivateAlert('alert-1')

      expect(supabase.from).toHaveBeenCalledWith('price_alerts')
      expect(builder.update).toHaveBeenCalledWith({ is_active: false })
      expect(builder.eq).toHaveBeenCalledWith('id', 'alert-1')
    })

    it('throws on DB error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'update failed' },
      })
      const supabase = createMockSupabase(() => builder)
      const service = new AlertService(supabase)

      await expect(service.deactivateAlert('alert-1')).rejects.toThrow(
        'Failed to deactivate alert: update failed'
      )
    })
  })

  // -------------------------------------------------------------------------
  // checkAlerts
  // -------------------------------------------------------------------------
  describe('checkAlerts', () => {
    it('triggers alert when current price is below target', async () => {
      const activeAlert = {
        ...ALERT_ROW,
        target_price_cents: 300,
        products: { name: 'Milk', store_id: 'store-1', stores: { slug: 'ah' } },
      }

      let callIndex = 0
      const supabase = createMockSupabase((table) => {
        if (table === 'price_alerts') {
          if (callIndex === 0) {
            callIndex++
            // First call: fetch active alerts
            return createMockQueryBuilder({ data: [activeAlert], error: null })
          }
          // Second call: update triggered alert
          return createMockQueryBuilder({ data: null, error: null })
        }
        if (table === 'prices') {
          // Current price is 250, below target of 300
          return createMockQueryBuilder({ data: { price_cents: 250 }, error: null })
        }
        return createMockQueryBuilder({ data: null, error: null })
      })

      const service = new AlertService(supabase)
      const result = await service.checkAlerts()

      expect(result.checked).toBe(1)
      expect(result.triggered).toBe(1)
      expect(result.alerts[0].productName).toBe('Milk')
      expect(result.alerts[0].currentPriceCents).toBe(250)
      expect(result.alerts[0].storeSlug).toBe('ah')
      expect(result.alerts[0].isActive).toBe(false)
      expect(result.alerts[0].triggeredAt).toBeInstanceOf(Date)
    })

    it('does not trigger alert when current price is above target', async () => {
      const activeAlert = {
        ...ALERT_ROW,
        target_price_cents: 200,
        products: { name: 'Milk', store_id: 'store-1', stores: { slug: 'ah' } },
      }

      const supabase = createMockSupabase((table) => {
        if (table === 'price_alerts') {
          return createMockQueryBuilder({ data: [activeAlert], error: null })
        }
        if (table === 'prices') {
          // Current price 350 is above target of 200
          return createMockQueryBuilder({ data: { price_cents: 350 }, error: null })
        }
        return createMockQueryBuilder({ data: null, error: null })
      })

      const service = new AlertService(supabase)
      const result = await service.checkAlerts()

      expect(result.checked).toBe(1)
      expect(result.triggered).toBe(0)
      expect(result.alerts).toHaveLength(0)
    })

    it('already-triggered alert not re-checked (only active alerts fetched)', async () => {
      // checkAlerts only queries is_active=true, so triggered alerts are excluded
      const supabase = createMockSupabase(() => {
        return createMockQueryBuilder({ data: [], error: null })
      })

      const service = new AlertService(supabase)
      const result = await service.checkAlerts()

      expect(result.checked).toBe(0)
      expect(result.triggered).toBe(0)
    })

    it('handles multiple alerts for same product correctly', async () => {
      const alert1 = {
        ...ALERT_ROW,
        id: 'alert-1',
        target_price_cents: 300,
        products: { name: 'Milk', store_id: 'store-1', stores: { slug: 'ah' } },
      }
      const alert2 = {
        ...ALERT_ROW,
        id: 'alert-2',
        target_price_cents: 150, // below current price of 250
        products: { name: 'Milk', store_id: 'store-1', stores: { slug: 'ah' } },
      }

      let alertCallIndex = 0
      const supabase = createMockSupabase((table) => {
        if (table === 'price_alerts') {
          if (alertCallIndex === 0) {
            alertCallIndex++
            return createMockQueryBuilder({ data: [alert1, alert2], error: null })
          }
          // Update calls for triggered alerts
          return createMockQueryBuilder({ data: null, error: null })
        }
        if (table === 'prices') {
          // Current price 250: triggers alert1 (target 300) but not alert2 (target 150)
          return createMockQueryBuilder({ data: { price_cents: 250 }, error: null })
        }
        return createMockQueryBuilder({ data: null, error: null })
      })

      const service = new AlertService(supabase)
      const result = await service.checkAlerts()

      expect(result.checked).toBe(2)
      expect(result.triggered).toBe(1)
      expect(result.alerts[0].id).toBe('alert-1')
    })

    it('triggers alert when price equals target exactly', async () => {
      const activeAlert = {
        ...ALERT_ROW,
        target_price_cents: 250,
        products: { name: 'Bread', store_id: 'store-1', stores: { slug: 'jumbo' } },
      }

      let callIndex = 0
      const supabase = createMockSupabase((table) => {
        if (table === 'price_alerts') {
          if (callIndex === 0) {
            callIndex++
            return createMockQueryBuilder({ data: [activeAlert], error: null })
          }
          return createMockQueryBuilder({ data: null, error: null })
        }
        if (table === 'prices') {
          return createMockQueryBuilder({ data: { price_cents: 250 }, error: null })
        }
        return createMockQueryBuilder({ data: null, error: null })
      })

      const service = new AlertService(supabase)
      const result = await service.checkAlerts()

      expect(result.triggered).toBe(1)
    })

    it('skips alert when no current price found', async () => {
      const activeAlert = {
        ...ALERT_ROW,
        target_price_cents: 300,
        products: { name: 'Milk', store_id: 'store-1', stores: { slug: 'ah' } },
      }

      const supabase = createMockSupabase((table) => {
        if (table === 'price_alerts') {
          return createMockQueryBuilder({ data: [activeAlert], error: null })
        }
        if (table === 'prices') {
          return createMockQueryBuilder({ data: null, error: { message: 'not found' } })
        }
        return createMockQueryBuilder({ data: null, error: null })
      })

      const service = new AlertService(supabase)
      const result = await service.checkAlerts()

      expect(result.checked).toBe(1)
      expect(result.triggered).toBe(0)
    })
  })
})
