import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ListService } from '@/lib/lists/list-service'
import type { OptimizationInput } from '@/lib/optimizer/types'

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  return createClient(url, key)
}

/**
 * POST /api/lists/[id]/optimize
 * Runs the shopping optimizer on a list. Accepts optional { constraints }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as {
      constraints?: OptimizationInput['constraints']
    }

    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    const result = await service.optimizeList(id, body.constraints)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'List not found') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
