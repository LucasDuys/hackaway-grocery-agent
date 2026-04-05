import { NextResponse } from 'next/server'
import { store } from '@/lib/local-store'

/**
 * DELETE /api/alerts/[id]
 * Delete an alert by ID.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    store.deleteAlert(id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/alerts/[id]
 * Deactivate an alert. Body: { isActive: false }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json() as { isActive?: boolean }

    if (body.isActive === false) {
      store.deactivateAlert(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Only { isActive: false } is supported' },
      { status: 400 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
