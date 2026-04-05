import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ScraperOrchestrator } from '@/lib/scrapers/orchestrator'
import type { StoreSlug } from '@/lib/scrapers/types'

const VALID_SLUGS: StoreSlug[] = ['ah', 'jumbo', 'lidl', 'picnic', 'plus', 'aldi']

function isValidSlug(slug: string): slug is StoreSlug {
  return VALID_SLUGS.includes(slug as StoreSlug)
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  return createClient(url, key)
}

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured -- allow all requests
    return true
  }
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

/**
 * GET /api/cron/scrape
 * Runs all 6 store scrapers sequentially.
 * Protected by CRON_SECRET when configured.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdmin()
    const orchestrator = new ScraperOrchestrator(supabase)
    const result = await orchestrator.runAll()

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/scrape
 * Runs specific store scrapers. Accepts { stores: ['ah', 'jumbo'] }.
 * If no stores specified, runs all.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { stores?: string[] }
    const supabase = createSupabaseAdmin()
    const orchestrator = new ScraperOrchestrator(supabase)

    if (body.stores && Array.isArray(body.stores) && body.stores.length > 0) {
      const invalidSlugs = body.stores.filter((s) => !isValidSlug(s))
      if (invalidSlugs.length > 0) {
        return NextResponse.json(
          { error: `Invalid store slugs: ${invalidSlugs.join(', ')}` },
          { status: 400 }
        )
      }
      const slugs = body.stores as StoreSlug[]
      const result = await orchestrator.runStores(slugs)
      return NextResponse.json(result)
    }

    const result = await orchestrator.runAll()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
