import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findNearestStores } from '@/lib/locations/nearest-stores'
import type { StoreLocation } from '@/lib/locations/types'

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }
  return createClient(url, key)
}

/**
 * GET /api/stores/nearby?lat=52.13&lng=5.29&radius=5&stores=ah,jumbo
 * Returns stores within the given radius of the provided coordinates.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const lat = parseFloat(url.searchParams.get('lat') ?? '')
    const lng = parseFloat(url.searchParams.get('lng') ?? '')
    const radius = parseFloat(url.searchParams.get('radius') ?? '5')
    const storesParam = url.searchParams.get('stores')

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng query parameters are required and must be numbers' },
        { status: 400 }
      )
    }

    if (isNaN(radius) || radius <= 0) {
      return NextResponse.json(
        { error: 'radius must be a positive number' },
        { status: 400 }
      )
    }

    const storeSlugs = storesParam
      ? storesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined

    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('store_locations')
      .select('id, store_id, stores(slug), latitude, longitude, address, city, postal_code, osm_id')

    if (error) {
      throw new Error(`Failed to fetch store locations: ${error.message}`)
    }

    const locations: StoreLocation[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      storeId: row.store_id as string,
      storeSlug: (row.stores as { slug: string })?.slug ?? '',
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      address: row.address as string | null,
      city: row.city as string | null,
      postalCode: row.postal_code as string | null,
      osmId: row.osm_id as number | null,
    }))

    const results = findNearestStores(lat, lng, locations, {
      maxDistanceKm: radius,
      storeSlugs,
    })

    return NextResponse.json({
      stores: results.map((r) => ({
        id: r.location.id,
        storeSlug: r.location.storeSlug,
        latitude: r.location.latitude,
        longitude: r.location.longitude,
        address: r.location.address,
        city: r.location.city,
        postalCode: r.location.postalCode,
        distanceKm: Math.round(r.distanceKm * 100) / 100,
      })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
