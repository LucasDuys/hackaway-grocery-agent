export interface PriceHistory {
  productId: string
  prices: PricePoint[]
}

export interface PricePoint {
  priceCents: number
  scrapedAt: Date
  isOnSale: boolean
  originalPriceCents: number | null
}

export interface PriceTrend {
  productId: string
  currentPriceCents: number
  averagePriceCents: number
  lowestPriceCents: number
  highestPriceCents: number
  trend7d: 'rising' | 'falling' | 'stable'
  trend30d: 'rising' | 'falling' | 'stable'
  percentile: number // 0-100, where 0 = cheapest ever, 100 = most expensive ever
  isGoodDeal: boolean // current price <= 10th percentile
  isPriceAlert: boolean // current price > 90th percentile vs 30d average
}

export interface PriceChange {
  productId: string
  productName: string
  storeSlug: string
  oldPriceCents: number
  newPriceCents: number
  changeCents: number
  changePercent: number
  direction: 'up' | 'down'
}
