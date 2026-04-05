import * as fs from 'fs'
import * as path from 'path'
import type {
  OptimizationResult,
  StoreAssignment,
  StoreBreakdown,
  SingleStoreComparison,
} from './optimizer/types'

interface Product {
  name: string
  brand: string | null
  priceCents: number
  unitSize: string
  storeSlug: string
  imageUrl: string | null
  categoryRaw: string | null
  isOnSale: boolean
  originalPriceCents: number | null
}

interface ShoppingList {
  id: string
  name: string
  items: ListItem[]
  createdAt: string
  updatedAt: string
}

interface ListItem {
  id: string
  productName: string
  quantity: number
  storeSlug?: string
  priceCents?: number
}

interface Alert {
  id: string
  productName: string
  targetPriceCents: number
  currentPriceCents?: number
  storeSlug?: string
  isActive: boolean
  triggeredAt: string | null
  createdAt: string
}

const STORE_NAMES: Record<string, string> = {
  ah: 'Albert Heijn',
  jumbo: 'Jumbo',
  lidl: 'Lidl',
  plus: 'Plus',
  aldi: 'Aldi',
  picnic: 'Picnic',
}

class LocalStore {
  private products: Product[] = []
  private lists: Map<string, ShoppingList> = new Map()
  private alerts: Map<string, Alert> = new Map()

  constructor() {
    this.loadProducts()
  }

  private loadProducts() {
    try {
      const filePath = path.join(process.cwd(), 'data', 'products.json')
      this.products = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      this.products = []
    }
  }

  getProducts(): Product[] {
    return this.products
  }

  searchProducts(query: string, limit = 20): Product[] {
    const q = query.toLowerCase()
    return this.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.categoryRaw && p.categoryRaw.toLowerCase().includes(q)),
      )
      .slice(0, limit)
  }

  // -- Lists CRUD --

  createList(name: string): ShoppingList {
    const now = new Date().toISOString()
    const list: ShoppingList = {
      id: crypto.randomUUID(),
      name,
      items: [],
      createdAt: now,
      updatedAt: now,
    }
    this.lists.set(list.id, list)
    return list
  }

  getList(id: string): ShoppingList | null {
    return this.lists.get(id) ?? null
  }

  getAllLists(): ShoppingList[] {
    return [...this.lists.values()]
  }

  deleteList(id: string): void {
    this.lists.delete(id)
  }

  addItem(listId: string, productName: string, quantity: number = 1): ListItem {
    const list = this.lists.get(listId)
    if (!list) {
      throw new Error('List not found')
    }
    const item: ListItem = {
      id: crypto.randomUUID(),
      productName,
      quantity,
    }
    list.items.push(item)
    list.updatedAt = new Date().toISOString()
    return item
  }

  removeItem(listId: string, itemId: string): void {
    const list = this.lists.get(listId)
    if (!list) {
      throw new Error('List not found')
    }
    list.items = list.items.filter((i) => i.id !== itemId)
    list.updatedAt = new Date().toISOString()
  }

  updateItemQuantity(listId: string, itemId: string, quantity: number): void {
    const list = this.lists.get(listId)
    if (!list) {
      throw new Error('List not found')
    }
    const item = list.items.find((i) => i.id === itemId)
    if (!item) {
      throw new Error('Item not found')
    }
    item.quantity = quantity
    list.updatedAt = new Date().toISOString()
  }

  // -- Alerts CRUD --

  createAlert(productName: string, targetPriceCents: number): Alert {
    const alert: Alert = {
      id: crypto.randomUUID(),
      productName,
      targetPriceCents,
      isActive: true,
      triggeredAt: null,
      createdAt: new Date().toISOString(),
    }

    // Find current cheapest price for this product
    const matches = this.products.filter((p) =>
      p.name.toLowerCase().includes(productName.toLowerCase()),
    )
    if (matches.length > 0) {
      const cheapest = matches.reduce((a, b) =>
        a.priceCents < b.priceCents ? a : b,
      )
      alert.currentPriceCents = cheapest.priceCents
      alert.storeSlug = cheapest.storeSlug
    }

    this.alerts.set(alert.id, alert)
    return alert
  }

  getAlerts(activeOnly = false): Alert[] {
    const all = [...this.alerts.values()]
    if (activeOnly) {
      return all.filter((a) => a.isActive)
    }
    return all
  }

  deleteAlert(id: string): void {
    this.alerts.delete(id)
  }

  deactivateAlert(id: string): void {
    const alert = this.alerts.get(id)
    if (alert) {
      alert.isActive = false
    }
  }

  // -- Optimize --

  optimizeList(
    listId: string,
    constraints?: { storeSlugs?: string[] },
  ): OptimizationResult {
    const list = this.lists.get(listId)
    if (!list) {
      throw new Error('List not found')
    }

    const assignments: StoreAssignment[] = []
    const storeSubtotals: Map<string, { items: number; cents: number }> = new Map()

    for (const item of list.items) {
      const q = item.productName.toLowerCase()
      let matches = this.products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)),
      )

      if (constraints?.storeSlugs && constraints.storeSlugs.length > 0) {
        const slugSet = new Set(constraints.storeSlugs)
        matches = matches.filter((p) => slugSet.has(p.storeSlug))
      }

      if (matches.length === 0) {
        continue
      }

      // Pick cheapest
      const cheapest = matches.reduce((a, b) =>
        a.priceCents < b.priceCents ? a : b,
      )

      assignments.push({
        unifiedProductId: item.id,
        productName: item.productName,
        storeSlug: cheapest.storeSlug,
        storeName: STORE_NAMES[cheapest.storeSlug] ?? cheapest.storeSlug,
        priceCents: cheapest.priceCents,
        quantity: item.quantity,
        productId: item.id,
      })

      const existing = storeSubtotals.get(cheapest.storeSlug) ?? { items: 0, cents: 0 }
      existing.items += 1
      existing.cents += cheapest.priceCents * item.quantity
      storeSubtotals.set(cheapest.storeSlug, existing)
    }

    const totalCostCents = assignments.reduce(
      (sum, a) => sum + a.priceCents * a.quantity,
      0,
    )

    const storeBreakdown: StoreBreakdown[] = [...storeSubtotals.entries()].map(
      ([slug, data]) => ({
        storeSlug: slug,
        storeName: STORE_NAMES[slug] ?? slug,
        itemCount: data.items,
        subtotalCents: data.cents,
      }),
    )

    // Single store comparisons
    const allStoreSlugs = [...new Set(this.products.map((p) => p.storeSlug))]
    const singleStoreComparisons: SingleStoreComparison[] = allStoreSlugs.map(
      (slug) => {
        let total = 0
        let available = 0
        let missing = 0

        for (const item of list.items) {
          const q = item.productName.toLowerCase()
          const matches = this.products.filter(
            (p) =>
              p.storeSlug === slug &&
              (p.name.toLowerCase().includes(q) ||
                (p.brand && p.brand.toLowerCase().includes(q))),
          )
          if (matches.length > 0) {
            const cheapest = matches.reduce((a, b) =>
              a.priceCents < b.priceCents ? a : b,
            )
            total += cheapest.priceCents * item.quantity
            available++
          } else {
            missing++
          }
        }

        return {
          storeSlug: slug,
          storeName: STORE_NAMES[slug] ?? slug,
          totalCents: total,
          missingItems: missing,
          availableItems: available,
        }
      },
    )

    // Savings vs cheapest single store that has all items
    const fullCoverage = singleStoreComparisons.filter(
      (s) => s.missingItems === 0,
    )
    const cheapestSingle =
      fullCoverage.length > 0
        ? Math.min(...fullCoverage.map((s) => s.totalCents))
        : singleStoreComparisons.length > 0
          ? Math.min(...singleStoreComparisons.map((s) => s.totalCents))
          : totalCostCents

    return {
      assignments,
      totalCostCents,
      storeBreakdown,
      singleStoreComparisons,
      savingsCents: Math.max(0, cheapestSingle - totalCostCents),
    }
  }
}

export const store = new LocalStore()
