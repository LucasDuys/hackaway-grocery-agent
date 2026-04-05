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
 * POST /api/lists/[id]/items
 * Adds an item to a list. Accepts { productName, quantity?, unifiedProductId? }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as {
      productName?: string
      quantity?: number
      unifiedProductId?: string
    }

    if (!body.productName || typeof body.productName !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: productName' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    const item = await service.addItem(
      id,
      body.productName,
      body.quantity,
      body.unifiedProductId,
    )
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/lists/[id]/items
 * Removes an item from a list. Accepts { itemId }.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as { itemId?: string }

    if (!body.itemId || typeof body.itemId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: itemId' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    await service.removeItem(id, body.itemId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/lists/[id]/items
 * Updates the quantity of a list item. Accepts { itemId, quantity }.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as {
      itemId?: string
      quantity?: number
    }

    if (!body.itemId || typeof body.itemId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: itemId' },
        { status: 400 },
      )
    }
    if (typeof body.quantity !== 'number' || body.quantity < 1) {
      return NextResponse.json(
        { error: 'quantity must be a positive number' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdmin()
    const service = new ListService(supabase as never)
    await service.updateItemQuantity(id, body.itemId, body.quantity)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
