import type { PicnicOrder, Recommendation } from "@/types";

export function predictReplenishment(orders: PicnicOrder[]): Recommendation[] {
  if (orders.length === 0) return [];

  const now = new Date();
  const allItems = new Map<
    string,
    { name: string; purchases: Date[]; quantities: number[]; prices: number[] }
  >();

  // Sort orders by delivery_time descending (most recent first)
  const sorted = [...orders].sort((a, b) => b.delivery_time - a.delivery_time);

  for (const order of sorted) {
    const date = new Date(order.delivery_time);
    for (const item of order.items) {
      if (!allItems.has(item.selling_unit_id)) {
        allItems.set(item.selling_unit_id, {
          name: item.name,
          purchases: [],
          quantities: [],
          prices: [],
        });
      }
      const entry = allItems.get(item.selling_unit_id)!;
      entry.purchases.push(date);
      entry.quantities.push(item.quantity);
      entry.prices.push(item.price);
    }
  }

  const recommendations: Recommendation[] = [];

  for (const [id, data] of allItems) {
    const { name, purchases, quantities, prices } = data;
    const sortedDates = [...purchases].sort(
      (a, b) => a.getTime() - b.getTime()
    );
    const lastBought = sortedDates[sortedDates.length - 1];
    const daysSinceLast =
      (now.getTime() - lastBought.getTime()) / (1000 * 60 * 60 * 24);

    // Signal 1: Frequency ratio (max 40 points)
    const frequencyRatio = purchases.length / orders.length;
    const stapleScore = frequencyRatio * 40;

    // Signal 2: Overdue score (max 40 points)
    let overdueScore = 0;
    if (purchases.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push(
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
            (1000 * 60 * 60 * 24)
        );
      }
      const sortedIntervals = [...intervals].sort((a, b) => a - b);
      const medianInterval =
        sortedIntervals[Math.floor(sortedIntervals.length / 2)];
      if (medianInterval > 0) {
        const overdueRatio = daysSinceLast / medianInterval;
        overdueScore = Math.min(40, Math.max(0, (overdueRatio - 0.5) * 40));
      }
    }

    // Signal 3: Recency boost (10 points if in most recent order)
    const mostRecentOrder = sorted[0];
    const wasInLastOrder = mostRecentOrder?.items?.some(
      (i) => i.selling_unit_id === id
    );
    const recencyBoost = wasInLastOrder ? 10 : 0;

    // Signal 4: Consistency penalty (-20 if only bought once)
    const consistencyPenalty = purchases.length === 1 ? -20 : 0;

    const score = Math.min(
      100,
      Math.max(0, stapleScore + overdueScore + recencyBoost + consistencyPenalty)
    );

    const avgQty =
      quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const avgPrice =
      prices.reduce((a, b) => a + b, 0) / prices.length;

    let reason: string;
    let reasonTag: Recommendation["reasonTag"];

    if (frequencyRatio >= 0.7) {
      reason = "Weekly staple";
      reasonTag = "repeat";
    } else if (overdueScore > 25) {
      reason = "Overdue for replenishment";
      reasonTag = "overdue";
    } else if (frequencyRatio >= 0.4) {
      reason = "Regular purchase";
      reasonTag = "repeat";
    } else {
      reason = "Occasional item";
      reasonTag = "suggestion";
    }

    recommendations.push({
      itemId: id,
      name,
      score: Math.round(score),
      reason,
      reasonTag,
      suggestedQuantity: Math.round(avgQty),
      lastBought: lastBought.toISOString(),
      pricePerUnit: Math.round(avgPrice),
    });
  }

  return recommendations
    .filter((r) => r.score > 20)
    .sort((a, b) => b.score - a.score);
}
