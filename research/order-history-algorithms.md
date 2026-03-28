# Order History Pattern Analysis Algorithms

All pure TypeScript, no dependencies, runs in-browser in <100ms.

## 1. Item Classification (Staple Detection)

```typescript
function classifyItems(orders: Order[]): Map<string, 'staple' | 'regular' | 'occasional' | 'one-time'> {
  const totalOrders = orders.length;
  const itemOrderCount = new Map<string, number>();

  for (const order of orders) {
    const uniqueItems = new Set(order.items.map(i => i.selling_unit_id));
    for (const id of uniqueItems) {
      itemOrderCount.set(id, (itemOrderCount.get(id) || 0) + 1);
    }
  }

  const result = new Map();
  for (const [id, count] of itemOrderCount) {
    const ratio = count / totalOrders;
    if (ratio >= 0.7)       result.set(id, 'staple');      // 70%+ orders
    else if (ratio >= 0.4)  result.set(id, 'regular');     // 40-70%
    else if (ratio >= 0.15) result.set(id, 'occasional');  // 15-40%
    else                    result.set(id, 'one-time');
  }
  return result;
}
```

## 2. Replenishment Predictor (Highest Value Feature)

Combines frequency ratio + overdue score + recency boost into a 0-100 score.

```typescript
interface Recommendation {
  itemId: string;
  name: string;
  score: number;           // 0-100
  reason: string;
  suggestedQuantity: number;
  lastBought: Date;
}

function predictNextOrder(orders: Order[]): Recommendation[] {
  const now = new Date();
  const allItems = new Map<string, { name: string; purchases: Date[]; quantities: number[] }>();

  for (const order of orders) {
    const date = new Date(order.delivery_time);
    for (const item of order.items) {
      if (!allItems.has(item.selling_unit_id)) {
        allItems.set(item.selling_unit_id, { name: item.name, purchases: [], quantities: [] });
      }
      const entry = allItems.get(item.selling_unit_id)!;
      entry.purchases.push(date);
      entry.quantities.push(item.quantity);
    }
  }

  const recommendations: Recommendation[] = [];

  for (const [id, data] of allItems) {
    const { name, purchases, quantities } = data;
    const sortedDates = purchases.sort((a, b) => a.getTime() - b.getTime());
    const lastBought = sortedDates[sortedDates.length - 1];
    const daysSinceLast = (now.getTime() - lastBought.getTime()) / (1000 * 60 * 60 * 24);

    // Signal 1: Frequency ratio (max 40 points)
    const frequencyRatio = purchases.length / orders.length;
    const stapleScore = frequencyRatio * 40;

    // Signal 2: Overdue score (max 40 points)
    let overdueScore = 0;
    if (purchases.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      }
      const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
      const overdueRatio = daysSinceLast / medianInterval;
      overdueScore = Math.min(40, Math.max(0, (overdueRatio - 0.5) * 40));
    }

    // Signal 3: Recency boost (10 points if in last order)
    const wasInLastOrder = orders[0]?.items?.some(i => i.selling_unit_id === id);
    const recencyBoost = wasInLastOrder ? 10 : 0;

    // Signal 4: Consistency penalty (-20 if only bought once)
    const consistencyPenalty = purchases.length === 1 ? -20 : 0;

    const score = Math.min(100, Math.max(0,
      stapleScore + overdueScore + recencyBoost + consistencyPenalty));

    const avgQty = quantities.reduce((a, b) => a + b, 0) / quantities.length;

    let reason: string;
    if (frequencyRatio >= 0.7) reason = 'Weekly staple';
    else if (overdueScore > 25) reason = 'Overdue for replenishment';
    else if (frequencyRatio >= 0.4) reason = 'Regular purchase';
    else reason = 'Occasional item';

    recommendations.push({ itemId: id, name, score: Math.round(score), reason, suggestedQuantity: Math.round(avgQty), lastBought });
  }

  return recommendations.filter(r => r.score > 20).sort((a, b) => b.score - a.score);
}
```

## 3. Budget Analysis

```typescript
function analyzeBudget(orders: Order[]) {
  const sorted = [...orders].sort((a, b) =>
    new Date(a.delivery_time).getTime() - new Date(b.delivery_time).getTime());

  const orderTotals = sorted.map(o =>
    o.items.reduce((sum, i) => sum + i.price * i.quantity, 0));

  const avgWeeklySpend = orderTotals.reduce((a, b) => a + b, 0) / orderTotals.length;

  // Linear regression for trend
  const n = orderTotals.length;
  const xMean = (n - 1) / 2;
  const yMean = avgWeeklySpend;
  let numerator = 0, denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (orderTotals[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const spendTrend = slope > avgWeeklySpend * 0.02 ? 'increasing'
                   : slope < -avgWeeklySpend * 0.02 ? 'decreasing'
                   : 'stable';

  return { avgWeeklySpend, spendTrend, trendSlope: slope };
}
```

## 4. Co-Purchase Detection

```typescript
function findCoPurchases(orders: Order[], minSupport = 0.3) {
  const n = orders.length;
  const itemSets = orders.map(o => new Set(o.items.map(i => i.selling_unit_id)));

  const singleCount = new Map<string, number>();
  for (const set of itemSets) {
    for (const id of set) {
      singleCount.set(id, (singleCount.get(id) || 0) + 1);
    }
  }

  const candidates = [...singleCount.entries()].filter(([_, c]) => c >= 2).map(([id]) => id);
  const rules = [];

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      const both = itemSets.filter(s => s.has(a) && s.has(b)).length;
      const support = both / n;
      if (support >= minSupport) {
        const pA = singleCount.get(a)! / n;
        const pB = singleCount.get(b)! / n;
        rules.push({ itemA: a, itemB: b, support, confidence: support / pA, lift: support / (pA * pB) });
      }
    }
  }
  return rules.sort((a, b) => b.lift - a.lift);
}
```

## 5. Household Size Estimation

```typescript
function estimateHousehold(orders: Order[]) {
  const avgSpend = orders.reduce((sum, o) =>
    sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0), 0) / orders.length;

  const spendEur = avgSpend / 100;
  let estimatedSize: string;
  if (spendEur < 65)       estimatedSize = 'single';
  else if (spendEur < 105) estimatedSize = 'couple';
  else if (spendEur < 165) estimatedSize = 'small-family';
  else                     estimatedSize = 'large-family';

  return { estimatedSize, avgSpendPerOrder: avgSpend };
}
```

## 6. Jaccard Similarity (Basket Comparison)

```typescript
function jaccard(orderA: Set<string>, orderB: Set<string>): number {
  const intersection = new Set([...orderA].filter(x => orderB.has(x)));
  const union = new Set([...orderA, ...orderB]);
  return intersection.size / union.size;
}
```

## Cold-Start Strategy

| Orders | Strategy |
|---|---|
| 0 | Empty state: "Place your first order to get insights" |
| 1 | Show as "your usual items." Assume weekly cadence. |
| 2-3 | Overlap = staples. Items in all orders get staple status. |
| 4-5 | Frequency ratio meaningful. Weekly vs bi-weekly detectable. |
| 6+ | All algorithms work well. |

## Build Priority (for hackathon)

1. Replenishment predictor (highest demo value) -- 30 min
2. Staple classification (feeds into predictor) -- 15 min
3. Budget overview with trend -- 20 min
4. Co-purchase pairs ("did you forget...?") -- 20 min
5. Household size estimation -- 10 min
