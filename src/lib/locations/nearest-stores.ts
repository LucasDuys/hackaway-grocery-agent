import type { StoreLocation, NearestStoreResult } from "./types"

const EARTH_RADIUS_KM = 6371

/**
 * Haversine formula to calculate the great-circle distance between two
 * latitude/longitude points on Earth.
 *
 * @returns Distance in kilometres.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Find the N nearest store locations from a given point.
 * Can filter by store slug and maximum distance.
 */
export function findNearestStores(
  userLat: number,
  userLng: number,
  locations: StoreLocation[],
  options?: {
    maxDistanceKm?: number
    limit?: number
    storeSlugs?: string[]
  }
): NearestStoreResult[] {
  const { maxDistanceKm, limit, storeSlugs } = options ?? {}

  let filtered = locations
  if (storeSlugs && storeSlugs.length > 0) {
    const slugSet = new Set(storeSlugs)
    filtered = filtered.filter((loc) => slugSet.has(loc.storeSlug))
  }

  let results: NearestStoreResult[] = filtered.map((location) => ({
    location,
    distanceKm: haversineDistance(
      userLat,
      userLng,
      location.latitude,
      location.longitude
    ),
  }))

  if (maxDistanceKm !== undefined) {
    results = results.filter((r) => r.distanceKm <= maxDistanceKm)
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm)

  if (limit !== undefined) {
    results = results.slice(0, limit)
  }

  return results
}
