import { NextResponse } from 'next/server'
import { store } from '@/lib/local-store'

/**
 * GET /api/alerts
 * List all alerts. Pass ?active=true to filter to active only.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('active') === 'true'

    const alerts = store.getAlerts(activeOnly)

    return NextResponse.json({ alerts })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/alerts
 * Create a new price alert.
 * Body: { productName: string, targetPriceCents: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      productName?: string
      targetPriceCents?: number
    }

    if (!body.productName || typeof body.targetPriceCents !== 'number') {
      return NextResponse.json(
        { error: 'productName (string) and targetPriceCents (number) are required' },
        { status: 400 },
      )
    }

    const alert = store.createAlert(body.productName, body.targetPriceCents)

    return NextResponse.json({ alert }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
