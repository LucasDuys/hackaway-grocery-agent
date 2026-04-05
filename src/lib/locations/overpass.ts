import type { StoreLocation } from "./types"

const OVERPASS_API = "https://overpass-api.de/api/interpreter"

/** Map store brand names (from OSM) to our internal store slugs. */
export const BRAND_TO_SLUG: Record<string, string> = {
  "Albert Heijn": "ah",
  Jumbo: "jumbo",
  Lidl: "lidl",
  Plus: "plus",
  Aldi: "aldi",
  // Picnic is delivery-only, no physical locations
}

interface OverpassElement {
  type: string
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

/**
 * Fetch all Dutch supermarket locations from the OpenStreetMap Overpass API.
 * Only returns locations for brands we track (AH, Jumbo, Lidl, Plus, Aldi).
 */
export async function fetchDutchSupermarkets(): Promise<StoreLocation[]> {
  const query = `
    [out:json][timeout:120];
    area["ISO3166-1"="NL"]->.nl;
    node["shop"="supermarket"](area.nl);
    out body;
  `

  const response = await fetch(OVERPASS_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    throw new Error(
      `Overpass API request failed: ${response.status} ${response.statusText}`
    )
  }

  const data: OverpassResponse = await response.json()

  const locations: StoreLocation[] = []

  for (const element of data.elements) {
    const brand = element.tags?.brand ?? element.tags?.name
    if (!brand) continue

    const slug = BRAND_TO_SLUG[brand]
    if (!slug) continue

    locations.push({
      id: "",
      storeId: "",
      storeSlug: slug,
      latitude: element.lat,
      longitude: element.lon,
      address: element.tags?.["addr:street"]
        ? `${element.tags["addr:street"]} ${element.tags["addr:housenumber"] ?? ""}`.trim()
        : null,
      city: element.tags?.["addr:city"] ?? null,
      postalCode: element.tags?.["addr:postcode"] ?? null,
      osmId: element.id,
    })
  }

  return locations
}
