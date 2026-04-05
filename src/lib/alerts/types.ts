export interface PriceAlert {
  id: string
  productId: string
  unifiedProductId: string | null
  targetPriceCents: number
  isActive: boolean
  triggeredAt: Date | null
  createdAt: Date
  productName?: string
  currentPriceCents?: number
  storeSlug?: string
}

export interface AlertCheckResult {
  checked: number
  triggered: number
  alerts: PriceAlert[]
}
