/**
 * seed-orders.ts
 *
 * Fetches the real Picnic product catalog and generates 100 realistic mock
 * orders spanning ~2 years of weekly grocery shopping.
 *
 * Usage:
 *   npx tsx scripts/seed-orders.ts
 *
 * Env vars (optional):
 *   PICNIC_EMAIL    - Picnic account email
 *   PICNIC_PASSWORD - Picnic account password
 *
 * If credentials are missing, falls back to hardcoded Dutch product data.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Types (mirrors src/types/index.ts)
// ---------------------------------------------------------------------------

interface Product {
  selling_unit_id: string;
  name: string;
  price: number; // cents
  image_url?: string;
  unit_quantity?: string;
}

interface PicnicOrderItem {
  selling_unit_id: string;
  name: string;
  quantity: number;
  price: number; // cents
  image_url?: string;
}

interface PicnicOrder {
  delivery_id: string;
  delivery_time: number; // epoch ms
  status: string;
  items: PicnicOrderItem[];
}

// ---------------------------------------------------------------------------
// Picnic API client (minimal, standalone -- avoids import issues with tsx)
// ---------------------------------------------------------------------------

const BASE_URL =
  "https://storefront-prod.nl.picnicinternational.com/api/15";
const PAGES_URL = `${BASE_URL}/pages`;
const LOGIN_URL = `${BASE_URL}/user/login`;
const PICNIC_AGENT = "30100;3.3.0";
const PICNIC_DID = "AGENT-001";
const CLIENT_ID = 30100;

let authToken: string | null = null;

async function authenticate(
  email: string,
  password: string
): Promise<void> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-picnic-agent": PICNIC_AGENT,
      "x-picnic-did": PICNIC_DID,
    },
    body: JSON.stringify({
      key: email,
      password,
      client_id: CLIENT_ID,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const token = res.headers.get("x-picnic-auth");
  if (!token) {
    throw new Error(
      `Picnic login failed (HTTP ${res.status}). No x-picnic-auth header.`
    );
  }
  authToken = token;
}

async function apiGet<T = unknown>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${PAGES_URL}/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.append(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-picnic-auth": authToken!,
      "x-picnic-agent": PICNIC_AGENT,
      "x-picnic-did": PICNIC_DID,
    },
    signal: AbortSignal.timeout(10_000),
  });
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Product fetching
// ---------------------------------------------------------------------------

const SEARCH_QUERIES = [
  "melk",
  "brood",
  "kaas",
  "eieren",
  "pasta",
  "rijst",
  "kip",
  "gehakt",
  "tomaat",
  "ui",
  "aardappel",
  "appel",
  "banaan",
  "yoghurt",
  "boter",
  "olie",
  "koffie",
  "thee",
  "sap",
  "water",
  "chips",
  "chocolade",
  "zeep",
  "wc",
  "wasmiddel",
];

/** Raw API result shape (differs from our normalized Product type). */
interface RawSearchResult {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  unit_quantity?: string;
}

async function fetchProductCatalog(): Promise<Product[]> {
  const allProducts: Map<string, Product> = new Map();

  for (const query of SEARCH_QUERIES) {
    try {
      // The Picnic API returns { results: [...] } with `id` instead of `selling_unit_id`
      const res = await apiGet<{ results?: RawSearchResult[] }>(
        "hackathon-search-products",
        { query, limit: "20" }
      );
      const results = res.results ?? [];
      for (const r of results) {
        if (!allProducts.has(r.id)) {
          allProducts.set(r.id, {
            selling_unit_id: r.id,
            name: r.name,
            price: r.price,
            image_url: r.image_url,
            unit_quantity: r.unit_quantity,
          });
        }
      }
      console.log(
        `  [${query}] found ${results.length} products (pool: ${allProducts.size})`
      );
    } catch (err) {
      console.warn(`  [${query}] search failed:`, (err as Error).message);
    }

    // Small delay to avoid rate-limiting
    await sleep(300);
  }

  return Array.from(allProducts.values());
}

// ---------------------------------------------------------------------------
// Fallback hardcoded product data
// ---------------------------------------------------------------------------

function getHardcodedProducts(): Product[] {
  return [
    // Staples
    { selling_unit_id: "s9000001", name: "Halfvolle melk 1L", price: 119, image_url: undefined },
    { selling_unit_id: "s9000002", name: "Volkoren brood heel", price: 189, image_url: undefined },
    { selling_unit_id: "s9000003", name: "Scharreleieren 10 stuks", price: 299, image_url: undefined },
    { selling_unit_id: "s9000004", name: "Bananen 1kg", price: 179, image_url: undefined },
    { selling_unit_id: "s9000005", name: "Ongezouten roomboter", price: 249, image_url: undefined },
    { selling_unit_id: "s9000006", name: "Jonge Gouda kaas plakken", price: 239, image_url: undefined },
    { selling_unit_id: "s9000007", name: "Aardappelen kruimig 2kg", price: 249, image_url: undefined },
    { selling_unit_id: "s9000008", name: "Uien net 1kg", price: 129, image_url: undefined },
    { selling_unit_id: "s9000009", name: "Halfvolle yoghurt 500g", price: 109, image_url: undefined },
    { selling_unit_id: "s9000010", name: "Koffie snelfiltermaling", price: 479, image_url: undefined },
    // Regular
    { selling_unit_id: "s9000011", name: "Spaghetti 500g", price: 99, image_url: undefined },
    { selling_unit_id: "s9000012", name: "Penne rigate 500g", price: 99, image_url: undefined },
    { selling_unit_id: "s9000013", name: "Witte rijst 1kg", price: 189, image_url: undefined },
    { selling_unit_id: "s9000014", name: "Kipfilet 500g", price: 499, image_url: undefined },
    { selling_unit_id: "s9000015", name: "Half-om-half gehakt 500g", price: 449, image_url: undefined },
    { selling_unit_id: "s9000016", name: "Tomaten 500g", price: 179, image_url: undefined },
    { selling_unit_id: "s9000017", name: "Appels Elstar 1kg", price: 249, image_url: undefined },
    { selling_unit_id: "s9000018", name: "Olijfolie extra vierge 500ml", price: 399, image_url: undefined },
    { selling_unit_id: "s9000019", name: "Sinaasappelsap 1L", price: 159, image_url: undefined },
    { selling_unit_id: "s9000020", name: "Zwarte thee 20 zakjes", price: 139, image_url: undefined },
    { selling_unit_id: "s9000021", name: "Komkommer", price: 89, image_url: undefined },
    { selling_unit_id: "s9000022", name: "Paprika rood", price: 119, image_url: undefined },
    { selling_unit_id: "s9000023", name: "Wortelen 500g", price: 99, image_url: undefined },
    { selling_unit_id: "s9000024", name: "Broccoli", price: 149, image_url: undefined },
    { selling_unit_id: "s9000025", name: "Sla ijsberg", price: 119, image_url: undefined },
    // Occasional
    { selling_unit_id: "s9000026", name: "Naturel chips 200g", price: 199, image_url: undefined },
    { selling_unit_id: "s9000027", name: "Melk chocoladereep", price: 149, image_url: undefined },
    { selling_unit_id: "s9000028", name: "Handzeep pompfles", price: 179, image_url: undefined },
    { selling_unit_id: "s9000029", name: "Toiletpapier 8 rollen", price: 399, image_url: undefined },
    { selling_unit_id: "s9000030", name: "Wasmiddel vloeibaar 1L", price: 549, image_url: undefined },
    { selling_unit_id: "s9000031", name: "Bruiswater 1.5L", price: 59, image_url: undefined },
    { selling_unit_id: "s9000032", name: "Pindakaas 350g", price: 229, image_url: undefined },
    { selling_unit_id: "s9000033", name: "Hagelslag melk 400g", price: 219, image_url: undefined },
    { selling_unit_id: "s9000034", name: "Tomatenpuree 200g", price: 79, image_url: undefined },
    { selling_unit_id: "s9000035", name: "Knoflook net 3 stuks", price: 99, image_url: undefined },
    // One-time / rare
    { selling_unit_id: "s9000036", name: "Biologische honing 350g", price: 449, image_url: undefined },
    { selling_unit_id: "s9000037", name: "Sojasaus 250ml", price: 189, image_url: undefined },
    { selling_unit_id: "s9000038", name: "Couscous 500g", price: 159, image_url: undefined },
    { selling_unit_id: "s9000039", name: "Taco schelpen 12 stuks", price: 229, image_url: undefined },
    { selling_unit_id: "s9000040", name: "Kokosmilk 400ml", price: 159, image_url: undefined },
    { selling_unit_id: "s9000041", name: "Nasi goreng kruidenmix", price: 89, image_url: undefined },
    { selling_unit_id: "s9000042", name: "Stroopwafels 10 stuks", price: 179, image_url: undefined },
    { selling_unit_id: "s9000043", name: "Vaatwastabletten 40 stuks", price: 699, image_url: undefined },
    { selling_unit_id: "s9000044", name: "Keukenrol 2 stuks", price: 249, image_url: undefined },
    { selling_unit_id: "s9000045", name: "Huisbakken frites 1kg", price: 229, image_url: undefined },
    // Seasonal (winter soups)
    { selling_unit_id: "s9000046", name: "Pompoen", price: 199, image_url: undefined },
    { selling_unit_id: "s9000047", name: "Prei", price: 129, image_url: undefined },
    { selling_unit_id: "s9000048", name: "Selderij", price: 109, image_url: undefined },
    { selling_unit_id: "s9000049", name: "Groentebouillon 12 blokjes", price: 119, image_url: undefined },
    { selling_unit_id: "s9000050", name: "Erwtensoep blik 800ml", price: 249, image_url: undefined },
  ];
}

// ---------------------------------------------------------------------------
// Product classification for order generation
// ---------------------------------------------------------------------------

interface ClassifiedProduct extends Product {
  tier: "staple" | "regular" | "occasional" | "rare";
  maxQuantity: number;
}

/**
 * Classify products into shopping frequency tiers based on name heuristics.
 */
function classifyProducts(products: Product[]): ClassifiedProduct[] {
  const staplePatterns =
    /melk|brood|eier|banaan|boter|kaas|aardappel|ui(en)?|yoghurt|koffie/i;
  const regularPatterns =
    /pasta|spaghetti|penne|rijst|kip|gehakt|tomaat|tomaten|appel|olie|sap|thee|komkommer|paprika|wortel|broccoli|sla/i;
  const occasionalPatterns =
    /chips|chocola|zeep|toiletpapier|wasmiddel|water|bruiswater|pindakaas|hagelslag|tomatenpuree|knoflook/i;
  const seasonalPatterns =
    /pompoen|prei|selderij|bouillon|soep|erwten/i;

  return products.map((p) => {
    let tier: ClassifiedProduct["tier"] = "rare";
    let maxQuantity = 1;

    if (staplePatterns.test(p.name)) {
      tier = "staple";
      maxQuantity = /melk|brood/i.test(p.name) ? 6 : 2;
    } else if (regularPatterns.test(p.name)) {
      tier = "regular";
      maxQuantity = 2;
    } else if (occasionalPatterns.test(p.name) || seasonalPatterns.test(p.name)) {
      tier = "occasional";
      maxQuantity = 2;
    } else {
      tier = "rare";
      maxQuantity = 1;
    }

    return { ...p, tier, maxQuantity };
  });
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (deterministic output)
// ---------------------------------------------------------------------------

function createRng(seed: number) {
  let s = seed | 0;
  return {
    /** Returns a float in [0, 1). Mulberry32 PRNG. */
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Returns an integer in [min, max] inclusive. */
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    /** Pick a random element from an array. */
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    /** Shuffle an array in place (Fisher-Yates). */
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

// ---------------------------------------------------------------------------
// Order generation
// ---------------------------------------------------------------------------

function generateOrders(products: Product[], count: number): PicnicOrder[] {
  const rng = createRng(42);
  const classified = classifyProducts(products);

  const allStaples = classified.filter((p) => p.tier === "staple");
  const allRegulars = classified.filter((p) => p.tier === "regular");
  const allOccasionals = classified.filter((p) => p.tier === "occasional");
  const allRares = classified.filter((p) => p.tier === "rare");

  console.log(
    `Product tiers: ${allStaples.length} staples, ${allRegulars.length} regulars, ` +
      `${allOccasionals.length} occasional, ${allRares.length} rare`
  );

  // Select a "household favorites" subset from each tier to simulate
  // a real household that buys from a consistent but not exhaustive set.
  // This keeps order sizes realistic (15-40 items) even with 500+ products.
  const houseStaples = rng.shuffle([...allStaples]).slice(0, Math.min(15, allStaples.length));
  const houseRegulars = rng.shuffle([...allRegulars]).slice(0, Math.min(20, allRegulars.length));
  const houseOccasionals = rng.shuffle([...allOccasionals]).slice(0, Math.min(15, allOccasionals.length));
  const houseRares = rng.shuffle([...allRares]).slice(0, Math.min(25, allRares.length));

  console.log(
    `Household selection: ${houseStaples.length} staples, ${houseRegulars.length} regulars, ` +
      `${houseOccasionals.length} occasional, ${houseRares.length} rare`
  );

  // Start date: ~2 years ago, weekly orders
  const now = Date.now();
  const twoYearsMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
  const startDate = now - twoYearsMs;
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  // Delivery days: Mon=1, Wed=3, Fri=5 evenings (18:00-20:00)
  const deliveryDays = [1, 3, 5];

  const orders: PicnicOrder[] = [];

  for (let i = 0; i < count; i++) {
    const orderDate = new Date(startDate + i * weekMs);

    // Snap to nearest delivery day
    const currentDow = orderDate.getUTCDay(); // 0=Sun
    const targetDow = rng.pick(deliveryDays);
    const dayDiff = ((targetDow - currentDow + 7) % 7);
    orderDate.setUTCDate(orderDate.getUTCDate() + dayDiff);

    // Set evening time (18:00-20:00)
    orderDate.setUTCHours(rng.int(18, 20), rng.int(0, 59), 0, 0);

    const month = orderDate.getUTCMonth(); // 0-11
    const isWinter = month >= 10 || month <= 2; // Nov-Mar

    const items: PicnicOrderItem[] = [];
    const usedIds = new Set<string>();

    function addItem(product: ClassifiedProduct, qtyOverride?: number) {
      if (usedIds.has(product.selling_unit_id)) return;
      usedIds.add(product.selling_unit_id);

      const quantity = qtyOverride ?? rng.int(1, product.maxQuantity);
      items.push({
        selling_unit_id: product.selling_unit_id,
        name: product.name,
        quantity,
        price: product.price,
        image_url: product.image_url,
      });
    }

    // Staples: 80%+ chance each (from household subset)
    for (const p of houseStaples) {
      if (rng.next() < 0.85) {
        addItem(p);
      }
    }

    // Regulars: 40-70% chance each (from household subset)
    for (const p of houseRegulars) {
      if (rng.next() < 0.55) {
        addItem(p);
      }
    }

    // Occasionals: 15-40% chance each (from household subset)
    for (const p of houseOccasionals) {
      const chance = isWinter && /pompoen|prei|selderij|bouillon|soep|erwten/i.test(p.name)
        ? 0.5  // Higher chance for soup ingredients in winter
        : 0.25;
      if (rng.next() < chance) {
        addItem(p);
      }
    }

    // Rares: <15% chance, drawn from the full rare pool for variety
    for (const p of houseRares) {
      if (rng.next() < 0.1) {
        addItem(p);
      }
    }

    // Occasionally add a completely random product from the full catalog
    if (rng.next() < 0.3) {
      const randomProduct = rng.pick(classified);
      addItem(randomProduct);
    }

    // Ensure minimum 15 items per order by pulling from household pools
    if (items.length < 15) {
      const remaining = [
        ...houseStaples,
        ...houseRegulars,
        ...houseOccasionals,
      ].filter((p) => !usedIds.has(p.selling_unit_id));
      rng.shuffle(remaining);
      for (const p of remaining) {
        if (items.length >= 15) break;
        addItem(p);
      }
    }

    // If still short, pull from the wider pool
    if (items.length < 15) {
      const wider = [...classified].filter(
        (p) => !usedIds.has(p.selling_unit_id)
      );
      rng.shuffle(wider);
      for (const p of wider) {
        if (items.length >= 15) break;
        addItem(p);
      }
    }

    // Cap at 40 items
    while (items.length > 40) {
      items.pop();
    }

    // Calculate total -- allow a wide realistic range (EUR 40-180)
    // Real Picnic orders vary widely; do not aggressively trim items.
    let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // If total is very low, bump some quantities
    while (total < 4000 && items.length > 0) {
      const idx = rng.int(0, items.length - 1);
      items[idx].quantity += 1;
      total += items[idx].price;
    }

    // Only trim if extremely over budget (> EUR 180)
    while (total > 18000 && items.length > 15) {
      const idx = rng.int(0, items.length - 1);
      if (items[idx].quantity > 1) {
        items[idx].quantity -= 1;
        total -= items[idx].price;
      } else {
        total -= items[idx].price * items[idx].quantity;
        items.splice(idx, 1);
      }
    }

    orders.push({
      delivery_id: `mock-${String(i + 1).padStart(4, "0")}`,
      delivery_time: orderDate.getTime(),
      status: "COMPLETED",
      items,
    });
  }

  return orders;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dataDir = resolve(__dirname, "../src/data");
  mkdirSync(dataDir, { recursive: true });

  let products: Product[];

  const email = process.env.PICNIC_EMAIL;
  const password = process.env.PICNIC_PASSWORD;

  if (email && password) {
    console.log("Authenticating with Picnic API...");
    try {
      await authenticate(email, password);
      console.log("Authenticated. Fetching product catalog...");
      products = await fetchProductCatalog();
      console.log(`Fetched ${products.length} unique products from Picnic API.`);
    } catch (err) {
      console.warn(
        `API authentication failed: ${(err as Error).message}`
      );
      console.log("Falling back to hardcoded product data.");
      products = getHardcodedProducts();
    }
  } else {
    console.log(
      "PICNIC_EMAIL / PICNIC_PASSWORD not set. Using hardcoded product data."
    );
    products = getHardcodedProducts();
  }

  if (products.length === 0) {
    console.error("No products available. Cannot generate orders.");
    process.exit(1);
  }

  // Save product catalog
  const catalogPath = resolve(dataDir, "product-catalog.json");
  writeFileSync(catalogPath, JSON.stringify(products, null, 2), "utf-8");
  console.log(`Saved ${products.length} products to ${catalogPath}`);

  // Generate orders
  console.log("Generating 100 mock orders...");
  const orders = generateOrders(products, 100);

  // Stats
  const totals = orders.map((o) =>
    o.items.reduce((s, i) => s + i.price * i.quantity, 0)
  );
  const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
  const avgItems =
    orders.reduce((s, o) => s + o.items.length, 0) / orders.length;

  console.log(`Generated ${orders.length} orders:`);
  console.log(`  Average items per order: ${avgItems.toFixed(1)}`);
  console.log(`  Average order total: EUR ${(avgTotal / 100).toFixed(2)}`);
  console.log(
    `  Date range: ${new Date(orders[0].delivery_time).toISOString().slice(0, 10)} to ${new Date(orders[orders.length - 1].delivery_time).toISOString().slice(0, 10)}`
  );

  // Save orders
  const ordersPath = resolve(dataDir, "mock-orders.json");
  writeFileSync(ordersPath, JSON.stringify(orders, null, 2), "utf-8");
  console.log(`Saved to ${ordersPath}`);

  console.log("Done.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
