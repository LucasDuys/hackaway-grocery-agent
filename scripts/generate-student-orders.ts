/**
 * generate-student-orders.ts
 *
 * Generates 50 mock orders representing a budget-conscious student shopper.
 * Uses real product IDs from the Picnic product catalog.
 *
 * Usage:
 *   npx tsx scripts/generate-student-orders.ts
 *
 * Output:
 *   src/data/mock-orders-student.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  selling_unit_id: string;
  name: string;
  price: number; // cents
  image_url: string;
  unit_quantity?: string;
}

interface PicnicOrderItem {
  selling_unit_id: string;
  name: string;
  quantity: number;
  price: number; // cents
  image_url: string;
}

interface PicnicOrder {
  delivery_id: string;
  delivery_time: number; // epoch ms
  status: string;
  items: PicnicOrderItem[];
}

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32 -- deterministic output)
// ---------------------------------------------------------------------------

function createRng(seed: number) {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

// ---------------------------------------------------------------------------
// Product classification for student shopping
// ---------------------------------------------------------------------------

type Tier = "staple" | "regular" | "occasional" | "rare";

interface ClassifiedProduct extends Product {
  tier: Tier;
}

/**
 * Match products from the catalog into student-relevant tiers.
 * Only selects budget-friendly items (prefers cheapest variant).
 */
function classifyStudentProducts(catalog: Product[]): ClassifiedProduct[] {
  // Staples: appear in 70%+ of orders
  const staplePatterns = [
    /pasta|spaghetti|penne|macaroni|fusilli/i,
    /rijst/i,
    /brood/i,
    /melk/i,
    /eier/i,
    /kaas/i,
  ];

  // Regular: appear in 40-70% of orders
  const regularPatterns = [
    /yoghurt/i,
    /boter/i,
    /koffie/i,
    /thee\b/i,
    /sap\b/i,
    /chips/i,
  ];

  // Occasional: appear in 15-40% of orders
  const occasionalPatterns = [
    /chocola/i,
    /koek|biscuit/i,
    /noodle/i,
    /appel/i,
    /banaan/i,
  ];

  // Rare: appear in <15% of orders
  const rarePatterns = [
    /wijn|mosterd/i,
    /wasmiddel|toiletpapier|schoonmaak|zeep|keukenrol|afwasmiddel/i,
  ];

  function matchTier(name: string): Tier | null {
    for (const p of staplePatterns) {
      if (p.test(name)) return "staple";
    }
    for (const p of regularPatterns) {
      if (p.test(name)) return "regular";
    }
    for (const p of occasionalPatterns) {
      if (p.test(name)) return "occasional";
    }
    for (const p of rarePatterns) {
      if (p.test(name)) return "rare";
    }
    return null;
  }

  const classified: ClassifiedProduct[] = [];

  for (const product of catalog) {
    const tier = matchTier(product.name);
    if (tier !== null) {
      classified.push({ ...product, tier });
    }
  }

  return classified;
}

/**
 * From classified products, select a smaller "student pantry" --
 * the specific products this student tends to buy. Prefer cheap variants.
 */
function selectStudentPantry(
  classified: ClassifiedProduct[],
  rng: ReturnType<typeof createRng>
): Map<Tier, ClassifiedProduct[]> {
  const byTier = new Map<Tier, ClassifiedProduct[]>();
  for (const tier of ["staple", "regular", "occasional", "rare"] as Tier[]) {
    byTier.set(tier, []);
  }

  for (const p of classified) {
    byTier.get(p.tier)!.push(p);
  }

  // Sort each tier by price ascending (student buys cheap)
  for (const [, products] of byTier) {
    products.sort((a, b) => a.price - b.price);
  }

  // Deduplicate by base name (keep cheapest variant of each product)
  function dedup(products: ClassifiedProduct[]): ClassifiedProduct[] {
    const seen = new Set<string>();
    const result: ClassifiedProduct[] = [];
    for (const p of products) {
      // Normalize: lowercase, strip quantity suffixes
      const baseName = p.name.toLowerCase().replace(/\d+\s*(x\s*)?\d*\s*(liter|ml|g|kg|stuks?|rollen?)?\s*$/i, "").trim();
      if (!seen.has(baseName)) {
        seen.add(baseName);
        result.push(p);
      }
    }
    return result;
  }

  const pantry = new Map<Tier, ClassifiedProduct[]>();

  // Select a realistic subset for a student
  const staples = dedup(byTier.get("staple")!);
  pantry.set("staple", rng.shuffle(staples).slice(0, Math.min(10, staples.length)));

  const regulars = dedup(byTier.get("regular")!);
  pantry.set("regular", rng.shuffle(regulars).slice(0, Math.min(8, regulars.length)));

  const occasionals = dedup(byTier.get("occasional")!);
  pantry.set("occasional", rng.shuffle(occasionals).slice(0, Math.min(8, occasionals.length)));

  const rares = dedup(byTier.get("rare")!);
  pantry.set("rare", rng.shuffle(rares).slice(0, Math.min(6, rares.length)));

  return pantry;
}

// ---------------------------------------------------------------------------
// Order generation
// ---------------------------------------------------------------------------

function generateStudentOrders(catalog: Product[]): PicnicOrder[] {
  const rng = createRng(2025);
  const classified = classifyStudentProducts(catalog);

  console.log(`Classified ${classified.length} products from catalog of ${catalog.length}`);

  const pantry = selectStudentPantry(classified, rng);

  for (const [tier, products] of pantry) {
    console.log(`  ${tier}: ${products.length} products`);
    for (const p of products) {
      console.log(`    - ${p.name} (${p.selling_unit_id}, ${p.price}c)`);
    }
  }

  const allPantryProducts = [
    ...pantry.get("staple")!,
    ...pantry.get("regular")!,
    ...pantry.get("occasional")!,
    ...pantry.get("rare")!,
  ];

  if (allPantryProducts.length < 10) {
    console.error("Not enough products matched. Cannot generate orders.");
    process.exit(1);
  }

  // Date range: March 2025 to March 2026
  const startDate = new Date("2025-03-03T18:00:00Z");
  const endDate = new Date("2026-03-28T18:00:00Z");

  // Generate 50 order dates with irregular cadence (5-10 day gaps)
  // 50 orders over ~385 days = avg 7.7 day gap, so 5-10 fits well
  const orderDates: Date[] = [];
  let currentDate = new Date(startDate);

  while (orderDates.length < 50 && currentDate < endDate) {
    // Snap to Wednesday (3) or Friday (5) evening
    const deliveryDay = rng.next() < 0.5 ? 3 : 5; // Wed or Fri
    const currentDow = currentDate.getUTCDay();
    let dayDiff = (deliveryDay - currentDow + 7) % 7;
    if (dayDiff === 0) dayDiff = 7; // at least move forward

    // If adding dayDiff would overshoot, take the nearest delivery day
    const deliveryDate = new Date(currentDate);
    deliveryDate.setUTCDate(deliveryDate.getUTCDate() + dayDiff);

    // Evening time (18:00 - 21:00)
    deliveryDate.setUTCHours(rng.int(18, 20), rng.int(0, 59), 0, 0);

    if (deliveryDate > endDate) break;

    orderDates.push(deliveryDate);

    // Advance by 2-6 days as the base gap. The snap-to-Wed/Fri logic
    // adds 1-7 more days, yielding effective gaps of ~5-10 days.
    const gap = rng.int(2, 6);
    currentDate = new Date(deliveryDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + gap);
  }

  console.log(`Generated ${orderDates.length} order dates`);

  // Tier inclusion probabilities
  const tierChance: Record<Tier, number> = {
    staple: 0.75,    // 70%+ of orders
    regular: 0.55,   // 40-70%
    occasional: 0.28, // 15-40%
    rare: 0.10,       // <15%
  };

  const orders: PicnicOrder[] = [];

  for (let i = 0; i < orderDates.length; i++) {
    const items: PicnicOrderItem[] = [];
    const usedIds = new Set<string>();

    function addItem(product: ClassifiedProduct) {
      if (usedIds.has(product.selling_unit_id)) return;
      usedIds.add(product.selling_unit_id);
      items.push({
        selling_unit_id: product.selling_unit_id,
        name: product.name,
        quantity: rng.int(1, 2), // students buy small quantities
        price: product.price,
        image_url: product.image_url,
      });
    }

    // Target item count for this order (6-10, varying per order)
    const targetItems = rng.int(6, 10);

    // Pick items from each tier based on probability
    for (const tier of ["staple", "regular", "occasional", "rare"] as Tier[]) {
      const products = pantry.get(tier)!;
      const chance = tierChance[tier];
      for (const p of products) {
        if (items.length >= targetItems) break;
        if (rng.next() < chance) {
          addItem(p);
        }
      }
    }

    // Ensure minimum items by pulling from staples and regulars
    if (items.length < targetItems) {
      const fillers = rng.shuffle([
        ...pantry.get("staple")!,
        ...pantry.get("regular")!,
      ]).filter((p) => !usedIds.has(p.selling_unit_id));
      for (const p of fillers) {
        if (items.length >= targetItems) break;
        addItem(p);
      }
    }

    // Hard cap at 10
    while (items.length > 10) {
      items.pop();
    }

    // Enforce spend range: EUR 25-50 (2500-5000 cents)
    let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // If too low, bump quantities
    let attempts = 0;
    while (total < 2500 && attempts < 20) {
      const idx = rng.int(0, items.length - 1);
      if (items[idx].quantity < 3) {
        items[idx].quantity += 1;
        total += items[idx].price;
      }
      attempts++;
    }

    // If still too low, add more items from pantry
    if (total < 2500) {
      const extras = rng.shuffle(allPantryProducts).filter(
        (p) => !usedIds.has(p.selling_unit_id)
      );
      for (const p of extras) {
        if (total >= 2500 || items.length >= 10) break;
        addItem(p);
        total += p.price;
      }
    }

    // If too high, reduce quantities or remove items
    attempts = 0;
    while (total > 5000 && attempts < 20) {
      const idx = rng.int(0, items.length - 1);
      if (items[idx].quantity > 1) {
        items[idx].quantity -= 1;
        total -= items[idx].price;
      } else if (items.length > 6) {
        total -= items[idx].price * items[idx].quantity;
        items.splice(idx, 1);
      }
      attempts++;
    }

    orders.push({
      delivery_id: `student-${String(i + 1).padStart(4, "0")}`,
      delivery_time: orderDates[i].getTime(),
      status: "COMPLETED",
      items,
    });
  }

  return orders;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const catalogPath = resolve(__dirname, "../src/data/product-catalog.json");
  const outputPath = resolve(__dirname, "../src/data/mock-orders-student.json");

  console.log("Loading product catalog...");
  const catalog: Product[] = JSON.parse(readFileSync(catalogPath, "utf-8"));
  console.log(`Loaded ${catalog.length} products`);

  console.log("Generating 50 student orders...");
  const orders = generateStudentOrders(catalog);

  // Stats
  const totals = orders.map((o) =>
    o.items.reduce((s, i) => s + i.price * i.quantity, 0)
  );
  const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const avgItems =
    orders.reduce((s, o) => s + o.items.length, 0) / orders.length;

  console.log(`\nGenerated ${orders.length} orders:`);
  console.log(`  Average items per order: ${avgItems.toFixed(1)}`);
  console.log(`  Average order total: EUR ${(avgTotal / 100).toFixed(2)}`);
  console.log(`  Min order total: EUR ${(minTotal / 100).toFixed(2)}`);
  console.log(`  Max order total: EUR ${(maxTotal / 100).toFixed(2)}`);
  console.log(
    `  Date range: ${new Date(orders[0].delivery_time).toISOString().slice(0, 10)} to ${new Date(orders[orders.length - 1].delivery_time).toISOString().slice(0, 10)}`
  );

  // Verify delivery days
  const dayCounts: Record<string, number> = {};
  for (const o of orders) {
    const day = new Date(o.delivery_time).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  console.log(`  Delivery days: ${JSON.stringify(dayCounts)}`);

  writeFileSync(outputPath, JSON.stringify(orders, null, 2), "utf-8");
  console.log(`\nSaved to ${outputPath}`);
}

main();
