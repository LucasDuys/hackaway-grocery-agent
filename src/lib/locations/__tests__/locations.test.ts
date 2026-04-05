import { describe, it, expect } from "vitest"
import { haversineDistance, findNearestStores } from "../nearest-stores"
import { BRAND_TO_SLUG } from "../overpass"
import type { StoreLocation } from "../types"

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------
describe("haversineDistance", () => {
  it("Eindhoven to Amsterdam is approximately 100 km", () => {
    // Eindhoven: 51.4416, 5.4697
    // Amsterdam: 52.3676, 4.9041
    const distance = haversineDistance(51.4416, 5.4697, 52.3676, 4.9041)
    expect(distance).toBeGreaterThan(90)
    expect(distance).toBeLessThan(120)
  })

  it("same point returns 0", () => {
    const distance = haversineDistance(52.0, 5.0, 52.0, 5.0)
    expect(distance).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// findNearestStores
// ---------------------------------------------------------------------------
const mockLocations: StoreLocation[] = [
  {
    id: "1",
    storeId: "s1",
    storeSlug: "ah",
    latitude: 52.3676,
    longitude: 4.9041,
    address: null,
    city: "Amsterdam",
    postalCode: null,
    osmId: 100,
  },
  {
    id: "2",
    storeId: "s2",
    storeSlug: "jumbo",
    latitude: 51.4416,
    longitude: 5.4697,
    address: null,
    city: "Eindhoven",
    postalCode: null,
    osmId: 200,
  },
  {
    id: "3",
    storeId: "s3",
    storeSlug: "lidl",
    latitude: 51.9225,
    longitude: 4.4792,
    address: null,
    city: "Rotterdam",
    postalCode: null,
    osmId: 300,
  },
  {
    id: "4",
    storeId: "s4",
    storeSlug: "ah",
    latitude: 52.0907,
    longitude: 5.1214,
    address: null,
    city: "Utrecht",
    postalCode: null,
    osmId: 400,
  },
]

describe("findNearestStores", () => {
  // User is in Utrecht (52.0907, 5.1214)
  const userLat = 52.0907
  const userLng = 5.1214

  it("returns correct stores sorted by distance", () => {
    const results = findNearestStores(userLat, userLng, mockLocations)

    expect(results.length).toBe(4)
    // Utrecht (distance ~0) should be first
    expect(results[0].location.city).toBe("Utrecht")
    expect(results[0].distanceKm).toBeLessThan(1)
    // Distances should be sorted ascending
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distanceKm).toBeGreaterThanOrEqual(
        results[i - 1].distanceKm
      )
    }
  })

  it("respects maxDistanceKm filter", () => {
    // Utrecht to Amsterdam is ~36km, Utrecht to Eindhoven is ~73km
    const results = findNearestStores(userLat, userLng, mockLocations, {
      maxDistanceKm: 50,
    })

    // Should include Utrecht (~0km), Amsterdam (~36km), Rotterdam (~47km)
    // but exclude Eindhoven (~73km)
    expect(results.every((r) => r.distanceKm <= 50)).toBe(true)
    expect(
      results.some((r) => r.location.city === "Eindhoven")
    ).toBe(false)
  })

  it("respects storeSlugs filter", () => {
    const results = findNearestStores(userLat, userLng, mockLocations, {
      storeSlugs: ["ah"],
    })

    expect(results.length).toBe(2)
    expect(results.every((r) => r.location.storeSlug === "ah")).toBe(true)
  })

  it("respects limit", () => {
    const results = findNearestStores(userLat, userLng, mockLocations, {
      limit: 2,
    })

    expect(results.length).toBe(2)
    // Should be the 2 closest
    expect(results[0].location.city).toBe("Utrecht")
  })
})

// ---------------------------------------------------------------------------
// Overpass brand mapping
// ---------------------------------------------------------------------------
describe("Overpass brand mapping", () => {
  it("maps 'Albert Heijn' to 'ah'", () => {
    expect(BRAND_TO_SLUG["Albert Heijn"]).toBe("ah")
  })

  it("maps 'Jumbo' to 'jumbo'", () => {
    expect(BRAND_TO_SLUG["Jumbo"]).toBe("jumbo")
  })

  it("excludes unknown brands", () => {
    expect(BRAND_TO_SLUG["Picnic"]).toBeUndefined()
    expect(BRAND_TO_SLUG["Dirk"]).toBeUndefined()
  })
})
