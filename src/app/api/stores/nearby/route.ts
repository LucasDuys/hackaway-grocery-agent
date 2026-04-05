import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { findNearestStores } from '@/lib/locations/nearest-stores'
import type { StoreLocation } from '@/lib/locations/types'

interface StoreLocationJson {
  storeSlug: string
  storeName: string
  latitude: number
  longitude: number
  address: string
  city: string
  postalCode: string
}

function loadStoreLocations(): StoreLocation[] {
  try {
    const filePath = path.join(process.cwd(), 'data', 'store-locations.json')
    const raw: StoreLocationJson[] = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return raw.map((loc, idx) => ({
      id: `loc-${idx}`,
      storeId: loc.storeSlug,
      storeSlug: loc.storeSlug,
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      city: loc.city,
      postalCode: loc.postalCode,
      osmId: null,
    }))
  } catch {
    return []
  }
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
        { status: 400 },
      )
    }

    if (isNaN(radius) || radius <= 0) {
      return NextResponse.json(
        { error: 'radius must be a positive number' },
        { status: 400 },
      )
    }

    const storeSlugs = storesParam
      ? storesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined

    const locations = loadStoreLocations()

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
      { status: 500 },
    )
  }
}
