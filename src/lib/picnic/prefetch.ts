/**
 * Parallel prefetch layer for Picnic API data.
 *
 * Usage:
 *   const data = await prefetchAll();
 *   const dataWithSearch = await prefetchAll(["pasta", "chicken breast"]);
 */

import type {
  PicnicData,
  PicnicOrder,
  PicnicProduct,
  PicnicDeliverySlot,
  PicnicCartItem,
  PicnicRecipe,
} from "@/types";
import type {
  RawOrderResponse,
  RawFavoritesResponse,
  RawCartResponse,
  RawDeliverySlotsResponse,
  RawSearchProductsResponse,
  RawSearchRecipesResponse,
} from "./types";
import { PicnicClient } from "./client";

/** Persona type for mock data selection. */
export type Persona = "family" | "student";

/** In-memory session cache, keyed by persona. Cleared when the server process restarts. */
const cacheMap: Record<string, { data: PicnicData; timestamp: number }> = {};
// Legacy aliases for backwards compatibility
let cache: PicnicData | null = null;
let cacheTimestamp = 0;

/** How long the cache stays valid (ms). Default: entire session (Infinity). */
const CACHE_TTL_MS = Infinity;

/** Maximum wall-clock time for the entire prefetch operation. */
const PREFETCH_TIMEOUT_MS = 5_000;

/**
 * Fetch all core Picnic data in parallel and return a unified PicnicData object.
 *
 * Results are cached in memory for the session. Subsequent calls return the
 * cached data unless `force` is set to true.
 *
 * @param searchQueries - Optional product search terms (e.g. recipe ingredients)
 * @param persona - Which persona's mock data to use ("family" | "student"), defaults to "family"
 * @param options.force - Bypass the cache and re-fetch everything
 */
export async function prefetchAll(
  searchQueries?: string[],
  persona?: Persona,
  options?: { force?: boolean }
): Promise<PicnicData> {
  const force = options?.force ?? false;
  const effectivePersona = persona ?? "family";
  const cacheKey = effectivePersona;

  // Return cached data if still valid and no new search queries
  const cached = cacheMap[cacheKey];
  if (
    !force &&
    cached &&
    Date.now() - cached.timestamp < CACHE_TTL_MS &&
    (!searchQueries || searchQueries.length === 0)
  ) {
    return cached.data;
  }

  const client = new PicnicClient();
  await client.authenticate();

  // Race all fetches against a timeout
  const result = await Promise.race([
    fetchAllData(client, searchQueries, effectivePersona),
    timeout(PREFETCH_TIMEOUT_MS),
  ]);

  // Cache the result per persona
  cacheMap[cacheKey] = { data: result, timestamp: Date.now() };

  return result;
}

/**
 * Invalidate the in-memory cache so the next prefetchAll() call re-fetches.
 */
export function invalidateCache(persona?: Persona): void {
  if (persona) {
    delete cacheMap[persona];
  } else {
    // Clear all persona caches
    for (const key of Object.keys(cacheMap)) {
      delete cacheMap[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function fetchAllData(
  client: PicnicClient,
  searchQueries?: string[],
  persona?: Persona
): Promise<PicnicData> {
  // Core fetches -- always run in parallel
  const [ordersRaw, favoritesRaw, cartRaw, slotsRaw] = await Promise.all([
    client.get<RawOrderResponse>("hackathon-list-orders", { limit: "20" }),
    client.get<RawFavoritesResponse>("hackathon-list-favorites", {
      limit: "50",
    }),
    client.get<RawCartResponse>("hackathon-get-cart"),
    client.get<RawDeliverySlotsResponse>("hackathon-get-delivery-slots"),
  ]);

  // Optional search queries -- also in parallel
  const searchResults: Record<string, PicnicProduct[]> = {};
  const recipes: PicnicRecipe[] = [];

  if (searchQueries && searchQueries.length > 0) {
    const searchPromises = searchQueries.flatMap((query) => [
      client
        .get<RawSearchProductsResponse>("hackathon-search-products", {
          query,
          limit: "20",
        })
        .then((res) => ({
          type: "products" as const,
          query,
          data: res,
        })),
      client
        .get<RawSearchRecipesResponse>("hackathon-search-recipes", {
          query,
          limit: "20",
        })
        .then((res) => ({
          type: "recipes" as const,
          query,
          data: res,
        })),
    ]);

    const searchSettled = await Promise.allSettled(searchPromises);

    for (const result of searchSettled) {
      if (result.status !== "fulfilled") continue;
      const { type, query, data } = result.value;

      if (type === "products") {
        const raw = data as RawSearchProductsResponse;
        // API returns { results: [{ id, name, price, ... }] } not { products: [...] }
        const products = (raw.results ?? []).map(p => ({
          selling_unit_id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.image_url,
          unit_quantity: p.unit_quantity,
        }));
        searchResults[query] = normalizeProducts(products);
      } else {
        const raw = data as RawSearchRecipesResponse;
        recipes.push(...normalizeRecipes(raw.recipes ?? []));
      }
    }
  }

  let orders = normalizeOrders(ordersRaw.orders ?? []);

  // Fall back to mock data when the API returns no order history
  if (orders.length === 0) {
    try {
      if (persona === "student") {
        const mockData = await import("@/data/mock-orders-student.json");
        orders = mockData.default as PicnicOrder[];
      } else {
        const mockData = await import("@/data/mock-orders.json");
        orders = mockData.default as PicnicOrder[];
      }
      console.log(
        `[prefetch] No API orders found. Loaded ${orders.length} mock orders (${persona ?? "family"} persona).`
      );
    } catch {
      console.warn("[prefetch] No mock order data available");
    }
  }

  let deliverySlots = normalizeSlots(slotsRaw.delivery_slots ?? []);

  // Fall back to mock delivery slots when the API returns none
  if (deliverySlots.length === 0) {
    deliverySlots = generateMockDeliverySlots();
    console.log(
      `[prefetch] No API delivery slots found. Generated ${deliverySlots.length} mock slots.`
    );
  }

  return {
    orders,
    favorites: normalizeProducts(favoritesRaw.favorites ?? []),
    cart: normalizeCart(cartRaw.items ?? []),
    deliverySlots,
    searchResults,
    recipes,
  };
}

// ---------------------------------------------------------------------------
// Normalizers -- map raw API shapes to our type-safe interfaces
// ---------------------------------------------------------------------------

function normalizeOrders(
  raw: NonNullable<RawOrderResponse["orders"]>
): PicnicOrder[] {
  return raw.map((o) => ({
    delivery_id: o.delivery_id,
    delivery_time: o.delivery_time,
    status: o.status,
    items: o.items.map((i) => ({
      selling_unit_id: i.selling_unit_id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      image_url: i.image_url,
    })),
  }));
}

function normalizeProducts(
  raw: NonNullable<RawFavoritesResponse["favorites"]>
): PicnicProduct[] {
  return raw.map((p) => ({
    selling_unit_id: p.selling_unit_id,
    name: p.name,
    price: p.price,
    image_url: p.image_url,
    unit_quantity: p.unit_quantity,
  }));
}

function normalizeCart(
  raw: NonNullable<RawCartResponse["items"]>
): PicnicCartItem[] {
  return raw.map((c) => ({
    selling_unit_id: c.selling_unit_id,
    name: c.name,
    quantity: c.quantity,
    price: c.price,
    image_url: c.image_url,
  }));
}

function normalizeSlots(
  raw: NonNullable<RawDeliverySlotsResponse["delivery_slots"]>
): PicnicDeliverySlot[] {
  return raw.map((s) => ({
    slot_id: s.slot_id,
    window_start: s.window_start,
    window_end: s.window_end,
    is_available: s.is_available,
  }));
}

function normalizeRecipes(
  raw: NonNullable<RawSearchRecipesResponse["recipes"]>
): PicnicRecipe[] {
  return raw.map((r) => {
    // Extract primary image hash from recipe images array
    const primaryImage = r.images?.images?.find((img) => img.primary) ?? r.images?.images?.[0];

    // The API returns ingredients with selling_unit_quantity (not quantity)
    // and selling_unit_id can be null (e.g. cupboard items like salt).
    // User-defined recipes return ingredients as null entirely.
    const ingredients = (r.ingredients ?? [])
      .filter((i) => i.selling_unit_id) // skip items without a product mapping
      .map((i) => ({
        selling_unit_id: i.selling_unit_id as string,
        name: i.name,
        quantity: i.selling_unit_quantity,
      }));

    return {
      id: r.id,
      name: r.name,
      portions: r.portions,
      imageUrl: primaryImage?.id,
      ingredients,
    };
  });
}

// ---------------------------------------------------------------------------
// Mock delivery slots fallback
// ---------------------------------------------------------------------------

/**
 * Generate 6 realistic mock delivery slots across the next 3 available days
 * (Mon/Wed/Fri pattern), with morning and evening windows each day.
 */
function generateMockDeliverySlots(): PicnicDeliverySlot[] {
  const slots: PicnicDeliverySlot[] = [];
  const now = new Date();
  const targetDays = [1, 3, 5]; // Monday, Wednesday, Friday
  let found = 0;
  let dayOffset = 1;

  // Find the next 3 days that fall on Mon/Wed/Fri
  const slotDates: Date[] = [];
  while (found < 3 && dayOffset <= 14) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + dayOffset);
    if (targetDays.includes(candidate.getDay())) {
      slotDates.push(candidate);
      found++;
    }
    dayOffset++;
  }

  for (let i = 0; i < slotDates.length; i++) {
    const d = slotDates[i];
    const dateStr = d.toISOString().slice(0, 10);

    // Morning window: 08:00 - 12:00
    slots.push({
      slot_id: `mock-${i * 2 + 1}`,
      window_start: `${dateStr}T08:00:00`,
      window_end: `${dateStr}T12:00:00`,
      is_available: true,
    });

    // Evening window: 18:00 - 21:00
    slots.push({
      slot_id: `mock-${i * 2 + 2}`,
      window_start: `${dateStr}T18:00:00`,
      window_end: `${dateStr}T21:00:00`,
      is_available: true,
    });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`Picnic prefetch timed out after ${ms}ms`)),
      ms
    );
  });
}
