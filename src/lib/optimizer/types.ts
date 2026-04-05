export interface OptimizationInput {
  items: Array<{
    unifiedProductId: string
    quantity: number
    productName: string
  }>
  constraints?: {
    maxStores?: number
    storeSlugs?: string[]  // Only consider these stores
    userLat?: number
    userLng?: number
    maxRadiusKm?: number
  }
}

export interface OptimizationResult {
  assignments: StoreAssignment[]
  totalCostCents: number
  storeBreakdown: StoreBreakdown[]
  singleStoreComparisons: SingleStoreComparison[]
  savingsCents: number  // vs cheapest single store
}

export interface StoreAssignment {
  unifiedProductId: string
  productName: string
  storeSlug: string
  storeName: string
  priceCents: number
  quantity: number
  productId: string
}

export interface StoreBreakdown {
  storeSlug: string
  storeName: string
  itemCount: number
  subtotalCents: number
}

export interface SingleStoreComparison {
  storeSlug: string
  storeName: string
  totalCents: number
  missingItems: number
  availableItems: number
}
