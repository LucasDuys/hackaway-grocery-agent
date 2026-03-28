import type { PicnicOrder, BudgetAnalysis } from "@/types";

export function analyzeBudget(orders: PicnicOrder[]): BudgetAnalysis {
  if (orders.length === 0) {
    return { avgWeeklySpend: 0, spendTrend: "stable", trendSlope: 0 };
  }

  const sorted = [...orders].sort(
    (a, b) => a.delivery_time - b.delivery_time
  );

  const orderTotals = sorted.map((o) =>
    o.items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)
  );

  const avgWeeklySpend =
    orderTotals.reduce((a, b) => a + b, 0) / orderTotals.length;

  if (orderTotals.length < 2) {
    return { avgWeeklySpend, spendTrend: "stable", trendSlope: 0 };
  }

  // Linear regression for trend
  const n = orderTotals.length;
  const xMean = (n - 1) / 2;
  const yMean = avgWeeklySpend;
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (orderTotals[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;

  let spendTrend: BudgetAnalysis["spendTrend"];
  if (avgWeeklySpend === 0) {
    spendTrend = "stable";
  } else if (slope > avgWeeklySpend * 0.02) {
    spendTrend = "increasing";
  } else if (slope < -avgWeeklySpend * 0.02) {
    spendTrend = "decreasing";
  } else {
    spendTrend = "stable";
  }

  return { avgWeeklySpend, spendTrend, trendSlope: slope };
}
