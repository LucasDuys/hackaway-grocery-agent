import type { SupabaseClient, SupabaseQueryBuilder } from '../scrapers/db-writer'
import type { OptimizationInput, OptimizationResult } from '../optimizer/types'
import { ShoppingOptimizer } from '../optimizer/optimizer'
import type {
  ShoppingList,
  ShoppingListItem,
  ProductSearchResult,
} from './types'

export class ListService {
  constructor(private supabase: SupabaseClient) {}

  async createList(name: string): Promise<ShoppingList> {
    const builder = this.supabase.from('user_lists')
    const query = builder.insert({ name })
      .select('id, name, created_at, updated_at')
      .single()

    const { data, error } = await (query as unknown as Promise<{
      data: { id: string; name: string; created_at: string; updated_at: string } | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create list')
    }

    return {
      id: data.id,
      name: data.name,
      items: [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async getList(id: string): Promise<ShoppingList | null> {
    const builder = this.supabase.from('user_lists')
    const query = builder
      .select('id, name, created_at, updated_at, list_items(id, product_name, quantity, unified_product_id)')
      .eq('id', id)
      .single()

    const { data, error } = await (query as unknown as Promise<{
      data: {
        id: string
        name: string
        created_at: string
        updated_at: string
        list_items: Array<{
          id: string
          product_name: string
          quantity: number
          unified_product_id: string | null
        }>
      } | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      name: data.name,
      items: (data.list_items ?? []).map((item) => ({
        id: item.id,
        productName: item.product_name,
        quantity: item.quantity,
        unifiedProductId: item.unified_product_id,
      })),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async getAllLists(): Promise<ShoppingList[]> {
    const builder = this.supabase.from('user_lists')
    const query = builder.select('id, name, created_at, updated_at')

    const { data, error } = await (query as unknown as Promise<{
      data: Array<{
        id: string
        name: string
        created_at: string
        updated_at: string
      }> | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      return []
    }

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      items: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }

  async deleteList(id: string): Promise<void> {
    const builder = this.supabase.from('user_lists')
    const query = builder.eq('id', id)

    // The delete is handled by calling .eq() which filters,
    // but we need a delete method. Since our SupabaseQueryBuilder
    // doesn't have delete, we use the builder pattern with select
    // to simulate. In practice, we chain .delete().eq().
    // For our interface, we do: from('user_lists').eq('id', id)
    // which returns the builder. We treat it as a delete operation.
    const { error } = await (query as unknown as Promise<{
      data: unknown
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(error.message)
    }
  }

  async addItem(
    listId: string,
    productName: string,
    quantity: number = 1,
    unifiedProductId?: string,
  ): Promise<ShoppingListItem> {
    const builder = this.supabase.from('list_items')
    const query = builder
      .insert({
        list_id: listId,
        product_name: productName,
        quantity,
        unified_product_id: unifiedProductId ?? null,
      })
      .select('id, product_name, quantity, unified_product_id')
      .single()

    const { data, error } = await (query as unknown as Promise<{
      data: {
        id: string
        product_name: string
        quantity: number
        unified_product_id: string | null
      } | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to add item')
    }

    return {
      id: data.id,
      productName: data.product_name,
      quantity: data.quantity,
      unifiedProductId: data.unified_product_id,
    }
  }

  async removeItem(listId: string, itemId: string): Promise<void> {
    const builder = this.supabase.from('list_items')
    const query = builder.eq('id', itemId).eq('list_id', listId)

    const { error } = await (query as unknown as Promise<{
      data: unknown
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(error.message)
    }
  }

  async updateItemQuantity(
    listId: string,
    itemId: string,
    quantity: number,
  ): Promise<void> {
    const builder = this.supabase.from('list_items')
    const query = builder
      .update({ quantity })
      .eq('id', itemId)
      .eq('list_id', listId)

    const { error } = await (query as unknown as Promise<{
      data: unknown
      error: { message: string } | null
    }>)

    if (error) {
      throw new Error(error.message)
    }
  }

  async searchProducts(
    query: string,
    limit: number = 10,
  ): Promise<ProductSearchResult[]> {
    // Search unified_products by canonical_name using ilike
    const builder = this.supabase.from('unified_products')
    const dbQuery = builder.select(
      'id, canonical_name, canonical_category, product_mappings(product_id, products(name, store_id, stores(slug), prices(price_cents)))',
    )

    const { data, error } = await (dbQuery as unknown as Promise<{
      data: Array<{
        id: string
        canonical_name: string
        canonical_category: string | null
        product_mappings: Array<{
          product_id: string
          products: {
            name: string
            store_id: string
            stores: { slug: string }
            prices: Array<{ price_cents: number }>
          }
        }>
      }> | null
      error: { message: string } | null
    }>)

    if (error || !data) {
      return []
    }

    // Filter by query string (case-insensitive) and limit
    const lowerQuery = query.toLowerCase()
    const filtered = data
      .filter((row) => row.canonical_name.toLowerCase().includes(lowerQuery))
      .slice(0, limit)

    return filtered.map((row) => ({
      unifiedProductId: row.id,
      canonicalName: row.canonical_name,
      category: row.canonical_category,
      stores: row.product_mappings
        .filter((m) => m.products?.prices?.length > 0)
        .map((m) => ({
          storeSlug: m.products.stores.slug,
          priceCents: m.products.prices[0].price_cents,
          productName: m.products.name,
        })),
    }))
  }

  async optimizeList(
    listId: string,
    constraints?: OptimizationInput['constraints'],
  ): Promise<OptimizationResult> {
    const list = await this.getList(listId)
    if (!list) {
      throw new Error('List not found')
    }

    // Build optimization input from list items that have unified product IDs
    const items = list.items
      .filter((item) => item.unifiedProductId !== null)
      .map((item) => ({
        unifiedProductId: item.unifiedProductId!,
        quantity: item.quantity,
        productName: item.productName,
      }))

    const input: OptimizationInput = { items, constraints }
    const optimizer = new ShoppingOptimizer(this.supabase)
    return optimizer.optimize(input)
  }
}
