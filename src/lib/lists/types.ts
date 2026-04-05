export interface ShoppingList {
  id: string
  name: string
  items: ShoppingListItem[]
  createdAt: Date
  updatedAt: Date
}

export interface ShoppingListItem {
  id: string
  productName: string
  quantity: number
  unifiedProductId: string | null
  matchedProduct?: {
    canonicalName: string
    cheapestPriceCents: number
    cheapestStore: string
  }
}

export interface ProductSearchResult {
  unifiedProductId: string
  canonicalName: string
  category: string | null
  stores: Array<{
    storeSlug: string
    priceCents: number
    productName: string
  }>
}
