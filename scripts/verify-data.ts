// Load data
const orders = require('../src/data/mock-orders.json');
const catalog = require('../src/data/product-catalog.json');

// Build catalog lookup
const catalogIds = new Set(catalog.map((p: any) => p.selling_unit_id));

// Check 1: All image hashes are 64 chars
let shortHashes = 0;
orders.forEach((o: any) => o.items.forEach((i: any) => {
  if (i.image_url && i.image_url.length < 60) shortHashes++;
}));
console.log(`Short image hashes: ${shortHashes}`);

// Check 2: Product IDs exist in catalog
let missingIds = 0;
const missingSet = new Set<string>();
orders.forEach((o: any) => o.items.forEach((i: any) => {
  if (!catalogIds.has(i.selling_unit_id)) {
    missingIds++;
    missingSet.add(i.selling_unit_id);
  }
}));
console.log(`Items with IDs not in catalog: ${missingIds} (${missingSet.size} unique)`);

// Check 3: Date range and cadence
const dates = orders.map((o: any) => new Date(o.delivery_time)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
console.log(`Date range: ${dates[0].toISOString().slice(0,10)} to ${dates[dates.length-1].toISOString().slice(0,10)}`);

// Check 4: Stats
const uniqueProducts = new Set<string>();
let totalItems = 0;
let totalSpend = 0;
orders.forEach((o: any) => {
  o.items.forEach((i: any) => {
    uniqueProducts.add(i.selling_unit_id);
    totalItems++;
    totalSpend += i.price * i.quantity;
  });
});
console.log(`Orders: ${orders.length}`);
console.log(`Unique products: ${uniqueProducts.size}`);
console.log(`Avg items/order: ${(totalItems/orders.length).toFixed(1)}`);
console.log(`Avg spend/order: EUR ${(totalSpend/orders.length/100).toFixed(2)}`);

// Check 5: Staple frequency
const itemFreq = new Map<string, number>();
orders.forEach((o: any) => {
  const seen = new Set(o.items.map((i: any) => i.selling_unit_id));
  seen.forEach((id: any) => itemFreq.set(id, (itemFreq.get(id)||0) + 1));
});
const staples = [...itemFreq.entries()].filter(([,c]) => c >= orders.length * 0.7);
console.log(`Staple items (70%+ orders): ${staples.length}`);
