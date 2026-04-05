import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ListService } from '@/lib/lists/list-service'

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  return createClient(url, key)
}

/**
 * GET /api/products/search?q=melk&limit=10
 * Searches unified products by name.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')
    const limitParam = url.searchParams.get('limit')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required query parameter: q' },
        { status: 400 },
      )
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 10
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'limit must be a positive number' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    const results = await service.searchProducts(query.trim(), limit)
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
