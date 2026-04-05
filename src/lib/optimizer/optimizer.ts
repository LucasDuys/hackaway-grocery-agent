import type { SupabaseClient } from '../scrapers/db-writer'
import type {
  OptimizationInput,
  OptimizationResult,
  StoreAssignment,
  StoreBreakdown,
  SingleStoreComparison,
} from './types'

/** A row from the price matrix: one product's price at one store */
interface PriceOption {
  unifiedProductId: string
  productName: string
  productId: string
  storeSlug: string
  storeName: string
  priceCents: number
}

/** Price matrix keyed by unifiedProductId -> array of store price options */
type PriceMatrix = Map<string, PriceOption[]>

export class ShoppingOptimizer {
  constructor(private supabase: SupabaseClient) {}

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    if (input.items.length === 0) {
      return {
        assignments: [],
        totalCostCents: 0,
        storeBreakdown: [],
        singleStoreComparisons: [],
        savingsCents: 0,
      }
    }

    // 1. Build the price matrix
    const priceMatrix = await this.buildPriceMatrix(input)

    // 2. Apply radius constraint if provided
    let allowedSlugs: Set<string> | null = null
    if (input.constraints?.storeSlugs && input.constraints.storeSlugs.length > 0) {
      allowedSlugs = new Set(input.constraints.storeSlugs)
    }
    if (
      input.constraints?.userLat !== undefined &&
      input.constraints?.userLng !== undefined &&
      input.constraints?.maxRadiusKm !== undefined
    ) {
      const nearbySlugs = await this.findNearbySlugs(
        input.constraints.userLat,
        input.constraints.userLng,
        input.constraints.maxRadiusKm,
      )
      if (allowedSlugs) {
        // Intersect with store slugs constraint
        allowedSlugs = new Set([...allowedSlugs].filter((s) => nearbySlugs.has(s)))
      } else {
        allowedSlugs = nearbySlugs
      }
    }

    // Filter price matrix by allowed slugs
    if (allowedSlugs) {
      for (const [id, options] of priceMatrix) {
        priceMatrix.set(id, options.filter((o) => allowedSlugs!.has(o.storeSlug)))
      }
    }

    // 3. Find optimal assignments
    const assignments = this.findOptimalAssignments(priceMatrix, input)

    // 4. Apply maxStores constraint via greedy merging
    const maxStores = input.constraints?.maxStores
    if (maxStores !== undefined && maxStores > 0) {
      this.mergeToMaxStores(assignments, priceMatrix, input, maxStores)
    }

    // 5. Calculate totals
    const totalCostCents = assignments.reduce(
      (sum, a) => sum + a.priceCents * a.quantity,
      0,
    )

    // 6. Store breakdowns
    const storeBreakdown = this.buildStoreBreakdown(assignments)

    // 7. Single-store comparisons
    const singleStoreComparisons = this.calculateSingleStoreComparisons(
      priceMatrix,
      input,
    )

    // 8. Savings vs cheapest single store (that has all items)
    const cheapestSingleStore = this.findCheapestSingleStoreTotal(
      singleStoreComparisons,
      input.items.length,
    )
    const savingsCents = cheapestSingleStore - totalCostCents

    return {
      assignments,
      totalCostCents,
      storeBreakdown,
      singleStoreComparisons,
      savingsCents: Math.max(0, savingsCents),
    }
  }

  /**
   * Build the price matrix: for each item, what does it cost at each store?
   * Query: unified_products -> product_mappings -> products -> prices (is_current=true)
   */
  async buildPriceMatrix(input: OptimizationInput): Promise<PriceMatrix> {
    const matrix: PriceMatrix = new Map()
    const unifiedIds = input.items.map((i) => i.unifiedProductId)

    // Query product_mappings joined with products, prices, and stores
    // to get current prices for all unified product IDs
    const builder = this.supabase.from('product_mappings')
    const query = builder
      .select(
        'unified_product_id, product_id, products(id, name, store_id, stores(slug, name)), prices(price_cents)',
      )
      .eq('unified_product_id', unifiedIds)

    const { data, error } = await (query as unknown as Promise<{
      data: Array<{
        unified_product_id: string
        product_id: string
        products: {
          id: string
          name: string
          store_id: string
          stores: { slug: string; name: string }
        }
        prices: Array<{ price_cents: number }>
      }> | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      return matrix
    }

    for (const row of data) {
      const unifiedId = row.unified_product_id
      const product = row.products
      const prices = row.prices

      if (!product || !prices || prices.length === 0) continue

      const store = product.stores
      if (!store) continue

      // Find the item name from input
      const inputItem = input.items.find((i) => i.unifiedProductId === unifiedId)
      const productName = inputItem?.productName ?? product.name

      const option: PriceOption = {
        unifiedProductId: unifiedId,
        productName,
        productId: product.id,
        storeSlug: store.slug,
        storeName: store.name,
        priceCents: prices[0].price_cents,
      }

      if (!matrix.has(unifiedId)) {
        matrix.set(unifiedId, [])
      }
      matrix.get(unifiedId)!.push(option)
    }

    return matrix
  }

  /**
   * Find store slugs within the given radius from the user's location.
   */
  private async findNearbySlugs(
    userLat: number,
    userLng: number,
    maxRadiusKm: number,
  ): Promise<Set<string>> {
    const builder = this.supabase.from('store_locations')
    const query = builder.select('store_id, latitude, longitude, stores(slug)')

    const { data, error } = await (query as unknown as Promise<{
      data: Array<{
        store_id: string
        latitude: number
        longitude: number
        stores: { slug: string }
      }> | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      return new Set()
    }

    const slugs = new Set<string>()
    for (const loc of data) {
      const dist = haversineDistance(userLat, userLng, loc.latitude, loc.longitude)
      if (dist <= maxRadiusKm && loc.stores?.slug) {
        slugs.add(loc.stores.slug)
      }
    }
    return slugs
  }

  /**
   * For each item, assign it to the cheapest available store.
   */
  private findOptimalAssignments(
    priceMatrix: PriceMatrix,
    input: OptimizationInput,
  ): StoreAssignment[] {
    const assignments: StoreAssignment[] = []

    for (const item of input.items) {
      const options = priceMatrix.get(item.unifiedProductId)
      if (!options || options.length === 0) continue

      // Sort by price, then by store slug for deterministic tie-breaking
      const sorted = [...options].sort((a, b) => {
        if (a.priceCents !== b.priceCents) return a.priceCents - b.priceCents
        return a.storeSlug.localeCompare(b.storeSlug)
      })

      const cheapest = sorted[0]
      assignments.push({
        unifiedProductId: item.unifiedProductId,
        productName: item.productName,
        storeSlug: cheapest.storeSlug,
        storeName: cheapest.storeName,
        priceCents: cheapest.priceCents,
        quantity: item.quantity,
        productId: cheapest.productId,
      })
    }

    return assignments
  }

  /**
   * Greedy merging: if too many stores, merge the least-impact store
   * into each item's next-best option, repeating until within limit.
   */
  private mergeToMaxStores(
    assignments: StoreAssignment[],
    priceMatrix: PriceMatrix,
    input: OptimizationInput,
    maxStores: number,
  ): void {
    let currentStores = this.getUniqueStores(assignments)

    while (currentStores.size > maxStores) {
      // For each store, calculate the cost of merging it away
      // (reassigning its items to the next cheapest store among remaining stores)
      let bestMergeSlug = ''
      let bestMergeCost = Infinity

      for (const slug of currentStores) {
        const otherSlugs = new Set([...currentStores].filter((s) => s !== slug))
        let mergeCost = 0
        let canMerge = true

        for (const assignment of assignments) {
          if (assignment.storeSlug !== slug) continue

          const options = priceMatrix.get(assignment.unifiedProductId)
          if (!options) {
            canMerge = false
            break
          }

          const alternatives = options
            .filter((o) => otherSlugs.has(o.storeSlug))
            .sort((a, b) => a.priceCents - b.priceCents)

          if (alternatives.length === 0) {
            // This item is only available at this store - can't merge
            canMerge = false
            break
          }

          mergeCost += (alternatives[0].priceCents - assignment.priceCents) * assignment.quantity
        }

        if (canMerge && mergeCost < bestMergeCost) {
          bestMergeCost = mergeCost
          bestMergeSlug = slug
        }
      }

      if (!bestMergeSlug) break // Can't merge any more stores

      // Perform the merge: reassign items from bestMergeSlug
      const otherSlugs = new Set([...currentStores].filter((s) => s !== bestMergeSlug))

      for (const assignment of assignments) {
        if (assignment.storeSlug !== bestMergeSlug) continue

        const options = priceMatrix.get(assignment.unifiedProductId)
        if (!options) continue

        const alternatives = options
          .filter((o) => otherSlugs.has(o.storeSlug))
          .sort((a, b) => a.priceCents - b.priceCents)

        if (alternatives.length > 0) {
          const best = alternatives[0]
          assignment.storeSlug = best.storeSlug
          assignment.storeName = best.storeName
          assignment.priceCents = best.priceCents
          assignment.productId = best.productId
        }
      }

      currentStores = this.getUniqueStores(assignments)
    }
  }

  private getUniqueStores(assignments: StoreAssignment[]): Set<string> {
    return new Set(assignments.map((a) => a.storeSlug))
  }

  private buildStoreBreakdown(assignments: StoreAssignment[]): StoreBreakdown[] {
    const map = new Map<string, StoreBreakdown>()

    for (const a of assignments) {
      const existing = map.get(a.storeSlug)
      if (existing) {
        existing.itemCount += 1
        existing.subtotalCents += a.priceCents * a.quantity
      } else {
        map.set(a.storeSlug, {
          storeSlug: a.storeSlug,
          storeName: a.storeName,
          itemCount: 1,
          subtotalCents: a.priceCents * a.quantity,
        })
      }
    }

    return [...map.values()].sort((a, b) => a.storeSlug.localeCompare(b.storeSlug))
  }

  /**
   * Calculate what each item would cost at a single store.
   */
  private calculateSingleStoreComparisons(
    priceMatrix: PriceMatrix,
    input: OptimizationInput,
  ): SingleStoreComparison[] {
    // Collect all unique stores from the price matrix
    const allStores = new Map<string, string>() // slug -> name
    for (const options of priceMatrix.values()) {
      for (const o of options) {
        allStores.set(o.storeSlug, o.storeName)
      }
    }

    const comparisons: SingleStoreComparison[] = []

    for (const [slug, name] of allStores) {
      let totalCents = 0
      let missingItems = 0
      let availableItems = 0

      for (const item of input.items) {
        const options = priceMatrix.get(item.unifiedProductId)
        const storeOption = options?.find((o) => o.storeSlug === slug)

        if (storeOption) {
          totalCents += storeOption.priceCents * item.quantity
          availableItems += 1
        } else {
          missingItems += 1
        }
      }

      comparisons.push({
        storeSlug: slug,
        storeName: name,
        totalCents,
        missingItems,
        availableItems,
      })
    }

    return comparisons.sort((a, b) => a.storeSlug.localeCompare(b.storeSlug))
  }

  /**
   * Find the cheapest single-store total among stores that have ALL items.
   * If no store has all items, use the cheapest total among stores with the most items.
   */
  private findCheapestSingleStoreTotal(
    comparisons: SingleStoreComparison[],
    totalItems: number,
  ): number {
    // First try stores with all items
    const fullStores = comparisons.filter((c) => c.missingItems === 0)
    if (fullStores.length > 0) {
      return Math.min(...fullStores.map((c) => c.totalCents))
    }

    // Fallback: store with most available items, then cheapest
    const sorted = [...comparisons].sort((a, b) => {
      if (a.availableItems !== b.availableItems) return b.availableItems - a.availableItems
      return a.totalCents - b.totalCents
    })

    return sorted.length > 0 ? sorted[0].totalCents : 0
  }
}

// Inline haversine to avoid circular dependencies
const EARTH_RADIUS_KM = 6371

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}
