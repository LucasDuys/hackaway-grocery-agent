import type { PicnicOrder, HouseholdEstimate } from "@/types";

export function estimateHousehold(orders: PicnicOrder[]): HouseholdEstimate {
  if (orders.length === 0) {
    return { estimatedSize: "single", avgSpendPerOrder: 0 };
  }

  const avgSpend =
    orders.reduce(
      (sum, o) =>
        sum + o.items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0),
      0
    ) / orders.length;

  const spendEur = avgSpend / 100;

  let estimatedSize: HouseholdEstimate["estimatedSize"];
  if (spendEur < 65) estimatedSize = "single";
  else if (spendEur < 105) estimatedSize = "couple";
  else if (spendEur < 165) estimatedSize = "small-family";
  else estimatedSize = "large-family";

  return { estimatedSize, avgSpendPerOrder: avgSpend };
}
