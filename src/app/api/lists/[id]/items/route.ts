import { NextResponse } from 'next/server'
import { store } from '@/lib/local-store'

/**
 * POST /api/lists/[id]/items
 * Adds an item to a list. Accepts { productName, quantity? }.
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
    }

    if (!body.productName || typeof body.productName !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: productName' },
        { status: 400 },
      )
    }

    const item = store.addItem(id, body.productName, body.quantity)
    return NextResponse.json(item, { status: 201 })
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

    store.removeItem(id, body.itemId)
    return NextResponse.json({ success: true })
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

    store.updateItemQuantity(id, body.itemId, body.quantity)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && (err.message === 'List not found' || err.message === 'Item not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
