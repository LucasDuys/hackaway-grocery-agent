import { NextResponse } from 'next/server'
import { store } from '@/lib/local-store'

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
      constraints?: { storeSlugs?: string[] }
    }

    const result = store.optimizeList(id, body.constraints)
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
