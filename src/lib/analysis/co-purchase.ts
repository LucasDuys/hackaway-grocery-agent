import type { PicnicOrder, CoPurchaseRule } from "@/types";

export function findCoPurchases(
  orders: PicnicOrder[],
  minSupport = 0.3
): CoPurchaseRule[] {
  if (orders.length < 2) return [];

  const n = orders.length;
  const itemSets = orders.map(
    (o) => new Set(o.items.map((i) => i.selling_unit_id))
  );

  const singleCount = new Map<string, number>();
  for (const set of itemSets) {
    for (const id of set) {
      singleCount.set(id, (singleCount.get(id) || 0) + 1);
    }
  }

  // Only consider items that appear in at least 2 orders
  const candidates = [...singleCount.entries()]
    .filter(([, c]) => c >= 2)
    .map(([id]) => id);

  const rules: CoPurchaseRule[] = [];

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const both = itemSets.filter((s) => s.has(a) && s.has(b)).length;
      const support = both / n;

      if (support >= minSupport) {
        const pA = singleCount.get(a)! / n;
        const pB = singleCount.get(b)! / n;
        const lift = support / (pA * pB);

        if (lift > 1.5) {
          rules.push({
            itemA: a,
            itemB: b,
            support,
            confidence: support / pA,
            lift,
          });
        }
      }
    }
  }

  return rules.sort((a, b) => b.lift - a.lift);
}
