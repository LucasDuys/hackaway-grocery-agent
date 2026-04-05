export interface StoreLocation {
  id: string
  storeId: string
  storeSlug: string
  latitude: number
  longitude: number
  address: string | null
  city: string | null
  postalCode: string | null
  osmId: number | null
}

export interface NearestStoreResult {
  location: StoreLocation
  distanceKm: number
}
