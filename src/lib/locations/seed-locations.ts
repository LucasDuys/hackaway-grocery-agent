import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchDutchSupermarkets } from "./overpass"

/**
 * Seed the store_locations table by fetching supermarket locations from
 * the OpenStreetMap Overpass API.
 *
 * Uses osm_id for deduplication -- existing rows with the same osm_id
 * are updated rather than duplicated.
 */
export async function seedStoreLocations(
  supabase: SupabaseClient
): Promise<{ inserted: number; skipped: number }> {
  // 1. Fetch locations from Overpass API
  const locations = await fetchDutchSupermarkets()

  // 2. Look up store_id for each slug from the stores table
  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, slug")

  if (storesError) {
    throw new Error(`Failed to fetch stores: ${storesError.message}`)
  }

  const slugToStoreId = new Map<string, string>()
  for (const store of stores ?? []) {
    slugToStoreId.set(store.slug, store.id)
  }

  // 3. Upsert into store_locations using osm_id for dedup
  let inserted = 0
  let skipped = 0

  for (const location of locations) {
    const storeId = slugToStoreId.get(location.storeSlug)
    if (!storeId) {
      skipped++
      continue
    }

    const row = {
      store_id: storeId,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      city: location.city,
      postal_code: location.postalCode,
      osm_id: location.osmId,
    }

    // If osm_id is present, check for existing record
    if (location.osmId) {
      const { data: existing } = await supabase
        .from("store_locations")
        .select("id")
        .eq("osm_id", location.osmId)
        .maybeSingle()

      if (existing) {
        // Update existing
        await supabase
          .from("store_locations")
          .update(row)
          .eq("id", existing.id)
        inserted++
        continue
      }
    }

    const { error: insertError } = await supabase
      .from("store_locations")
      .insert(row)

    if (insertError) {
      skipped++
    } else {
      inserted++
    }
  }

  return { inserted, skipped }
}
