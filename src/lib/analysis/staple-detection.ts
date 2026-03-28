import type { PicnicOrder, ItemClassification } from "@/types";

export function classifyItems(orders: PicnicOrder[]): ItemClassification[] {
  if (orders.length === 0) return [];

  const totalOrders = orders.length;
  const itemOrderCount = new Map<string, { name: string; count: number }>();

  for (const order of orders) {
    const seen = new Set<string>();
    for (const item of order.items) {
      if (seen.has(item.selling_unit_id)) continue;
      seen.add(item.selling_unit_id);

      const existing = itemOrderCount.get(item.selling_unit_id);
      if (existing) {
        existing.count += 1;
      } else {
        itemOrderCount.set(item.selling_unit_id, { name: item.name, count: 1 });
      }
    }
  }

  const results: ItemClassification[] = [];

  for (const [id, { name, count }] of itemOrderCount) {
    const ratio = count / totalOrders;
    let category: ItemClassification["category"];

    if (ratio >= 0.7) category = "staple";
    else if (ratio >= 0.4) category = "regular";
    else if (ratio >= 0.15) category = "occasional";
    else category = "one-time";

    results.push({ itemId: id, name, category, frequencyRatio: ratio });
  }

  return results;
}
