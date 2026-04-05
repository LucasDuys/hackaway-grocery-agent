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
 * GET /api/lists
 * Returns all shopping lists.
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    const lists = await service.getAllLists()
    return NextResponse.json(lists)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/lists
 * Creates a new shopping list. Accepts { name: string }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { name?: string }
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    const list = await service.createList(body.name)
    return NextResponse.json(list, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
