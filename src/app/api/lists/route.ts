import { NextResponse } from 'next/server'
import { store } from '@/lib/local-store'

/**
 * GET /api/lists
 * Returns all shopping lists.
 */
export async function GET() {
  try {
    const lists = store.getAllLists()
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

    const list = store.createList(body.name)
    return NextResponse.json(list, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
