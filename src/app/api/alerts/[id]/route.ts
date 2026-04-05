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
 * DELETE /api/alerts/[id]
 * Delete an alert by ID.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseAdmin()
    const service = new AlertService(supabase)
    await service.deleteAlert(id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/alerts/[id]
 * Deactivate an alert. Body: { isActive: false }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as { isActive?: boolean }

    if (body.isActive === false) {
      const supabase = createSupabaseAdmin()
      const service = new AlertService(supabase)
      await service.deactivateAlert(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Only { isActive: false } is supported' },
      { status: 400 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
