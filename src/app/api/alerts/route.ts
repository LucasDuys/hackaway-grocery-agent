import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AlertService } from '@/lib/alerts/alert-service'

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  return createClient(url, key)
}

/**
 * GET /api/alerts
 * List all alerts. Pass ?active=true to filter to active only.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('active') === 'true'

    const supabase = createSupabaseAdmin()
    const service = new AlertService(supabase)
    const alerts = await service.getAlerts({ activeOnly })

    return NextResponse.json({ alerts })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/alerts
 * Create a new price alert.
 * Body: { productId: string, targetPriceCents: number, unifiedProductId?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      productId?: string
      targetPriceCents?: number
      unifiedProductId?: string
    }

    if (!body.productId || typeof body.targetPriceCents !== 'number') {
      return NextResponse.json(
        { error: 'productId (string) and targetPriceCents (number) are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()
    const service = new AlertService(supabase)
    const alert = await service.createAlert(
      body.productId,
      body.targetPriceCents,
      body.unifiedProductId
    )

    return NextResponse.json({ alert }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
