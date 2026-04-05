import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListService } from '../list-service'
import type { SupabaseClient, SupabaseQueryBuilder } from '../../scrapers/db-writer'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface MockCall {
  table: string
  method: string
  args: unknown[]
}

function createMockSupabase(options?: {
  lists?: Array<{
    id: string
    name: string
    created_at: string
    updated_at: string
    list_items?: Array<{
      id: string
      product_name: string
      quantity: number
      unified_product_id: string | null
    }>
  }>
  insertedList?: {
    id: string
    name: string
    created_at: string
    updated_at: string
  }
  insertedItem?: {
    id: string
    product_name: string
    quantity: number
    unified_product_id: string | null
  }
  searchResults?: Array<{
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
  }>
  priceRows?: Array<{
    unified_product_id: string
    product_id: string
    products: {
      id: string
      name: string
      store_id: string
      stores: { slug: string; name: string }
    }
    prices: Array<{ price_cents: number }>
  }>
  error?: { message: string }
}) {
  const calls: MockCall[] = []

  const client: SupabaseClient = {
    from: vi.fn((table: string) => {
      calls.push({ table, method: 'from', args: [table] })

      const makeBuilder = (resolveData: unknown = null, resolveError: unknown = null): Record<string, unknown> => {
        const builder: Record<string, unknown> = {}

        builder.upsert = vi.fn(() => builder)
        builder.update = vi.fn(() => builder)
        builder.insert = vi.fn(() => builder)
        builder.eq = vi.fn((_col: string, _val: unknown) => {
          // Return a new builder that resolves with the appropriate data
          const eqBuilder = { ...builder }
          eqBuilder.eq = vi.fn(() => eqBuilder)
          eqBuilder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
            Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
          eqBuilder.select = vi.fn(() => {
            const selectBuilder = { ...eqBuilder }
            selectBuilder.single = vi.fn(() => ({
              then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
                if (table === 'user_lists' && options?.lists) {
                  const list = options.lists[0]
                  return Promise.resolve({ data: list ?? null, error: resolveError }).then(resolve, reject)
                }
                return Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
              },
            }))
            selectBuilder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
            return selectBuilder
          })
          return eqBuilder
        })
        builder.select = vi.fn((_columns?: string) => {
          const selectBuilder = { ...builder }
          selectBuilder.eq = vi.fn((_col: string, _val: unknown) => {
            const eqBuilder = { ...selectBuilder }
            eqBuilder.eq = vi.fn(() => eqBuilder)
            eqBuilder.single = vi.fn(() => ({
              then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
                if (table === 'user_lists' && options?.lists) {
                  const list = options.lists[0]
                  return Promise.resolve({ data: list ?? null, error: resolveError }).then(resolve, reject)
                }
                return Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
              },
            }))
            eqBuilder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
            return eqBuilder
          })
          selectBuilder.single = vi.fn(() => ({
            then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
              if (table === 'user_lists' && options?.insertedList) {
                return Promise.resolve({ data: options.insertedList, error: resolveError }).then(resolve, reject)
              }
              if (table === 'list_items' && options?.insertedItem) {
                return Promise.resolve({ data: options.insertedItem, error: resolveError }).then(resolve, reject)
              }
              return Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
            },
          }))
          selectBuilder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
            if (table === 'user_lists' && options?.lists) {
              return Promise.resolve({ data: options.lists, error: resolveError }).then(resolve, reject)
            }
            if (table === 'unified_products' && options?.searchResults) {
              return Promise.resolve({ data: options.searchResults, error: resolveError }).then(resolve, reject)
            }
            return Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)
          }
          return selectBuilder
        })
        builder.single = vi.fn(() => ({
          then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
            Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject),
        }))
        builder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
          Promise.resolve({ data: resolveData, error: resolveError }).then(resolve, reject)

        return builder
      }

      if (table === 'product_mappings' && options?.priceRows) {
        const builder = makeBuilder()
        builder.select = vi.fn().mockReturnValue({
          ...builder,
          eq: vi.fn().mockReturnValue({
            then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: options.priceRows, error: null }).then(resolve, reject),
          }),
        })
        return builder as unknown as SupabaseQueryBuilder
      }

      const resolveError = options?.error ?? null
      return makeBuilder(null, resolveError) as unknown as SupabaseQueryBuilder
    }),
  }

  return { client, calls }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListService', () => {
  // =========================================================================
  // createList
  // =========================================================================
  describe('createList', () => {
    it('inserts into user_lists and returns list with id', async () => {
      const { client } = createMockSupabase({
        insertedList: {
          id: 'list-1',
          name: 'Weekly Groceries',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
      })

      const service = new ListService(client)
      const result = await service.createList('Weekly Groceries')

      expect(result.id).toBe('list-1')
      expect(result.name).toBe('Weekly Groceries')
      expect(result.items).toEqual([])
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(client.from).toHaveBeenCalledWith('user_lists')
    })

    it('throws on error', async () => {
      const { client } = createMockSupabase({
        error: { message: 'DB error' },
      })

      const service = new ListService(client)
      await expect(service.createList('Test')).rejects.toThrow('DB error')
    })
  })

  // =========================================================================
  // addItem
  // =========================================================================
  describe('addItem', () => {
    it('inserts into list_items and returns item', async () => {
      const { client } = createMockSupabase({
        insertedItem: {
          id: 'item-1',
          product_name: 'Melk',
          quantity: 2,
          unified_product_id: 'u-milk',
        },
      })

      const service = new ListService(client)
      const result = await service.addItem('list-1', 'Melk', 2, 'u-milk')

      expect(result.id).toBe('item-1')
      expect(result.productName).toBe('Melk')
      expect(result.quantity).toBe(2)
      expect(result.unifiedProductId).toBe('u-milk')
      expect(client.from).toHaveBeenCalledWith('list_items')
    })

    it('defaults quantity to 1 when not provided', async () => {
      const { client } = createMockSupabase({
        insertedItem: {
          id: 'item-2',
          product_name: 'Brood',
          quantity: 1,
          unified_product_id: null,
        },
      })

      const service = new ListService(client)
      const result = await service.addItem('list-1', 'Brood')

      expect(result.quantity).toBe(1)
      expect(result.unifiedProductId).toBeNull()
    })
  })

  // =========================================================================
  // removeItem
  // =========================================================================
  describe('removeItem', () => {
    it('deletes from list_items without error', async () => {
      const { client } = createMockSupabase()

      const service = new ListService(client)
      await expect(service.removeItem('list-1', 'item-1')).resolves.toBeUndefined()
      expect(client.from).toHaveBeenCalledWith('list_items')
    })

    it('throws on error', async () => {
      const { client } = createMockSupabase({
        error: { message: 'Delete failed' },
      })

      const service = new ListService(client)
      await expect(service.removeItem('list-1', 'item-1')).rejects.toThrow('Delete failed')
    })
  })

  // =========================================================================
  // updateItemQuantity
  // =========================================================================
  describe('updateItemQuantity', () => {
    it('updates quantity in list_items', async () => {
      const { client } = createMockSupabase()

      const service = new ListService(client)
      await expect(service.updateItemQuantity('list-1', 'item-1', 5)).resolves.toBeUndefined()
      expect(client.from).toHaveBeenCalledWith('list_items')
    })

    it('throws on error', async () => {
      const { client } = createMockSupabase({
        error: { message: 'Update failed' },
      })

      const service = new ListService(client)
      await expect(service.updateItemQuantity('list-1', 'item-1', 3)).rejects.toThrow('Update failed')
    })
  })

  // =========================================================================
  // searchProducts
  // =========================================================================
  describe('searchProducts', () => {
    it('returns matching products with prices via fuzzy search', async () => {
      const { client } = createMockSupabase({
        searchResults: [
          {
            id: 'u-milk',
            canonical_name: 'Volle Melk 1L',
            canonical_category: 'Zuivel',
            product_mappings: [
              {
                product_id: 'p-ah-milk',
                products: {
                  name: 'AH Volle Melk',
                  store_id: 's-ah',
                  stores: { slug: 'ah' },
                  prices: [{ price_cents: 119 }],
                },
              },
              {
                product_id: 'p-jumbo-milk',
                products: {
                  name: 'Jumbo Volle Melk',
                  store_id: 's-jumbo',
                  stores: { slug: 'jumbo' },
                  prices: [{ price_cents: 109 }],
                },
              },
            ],
          },
          {
            id: 'u-halfmelk',
            canonical_name: 'Halfvolle Melk 1L',
            canonical_category: 'Zuivel',
            product_mappings: [
              {
                product_id: 'p-ah-halfmelk',
                products: {
                  name: 'AH Halfvolle Melk',
                  store_id: 's-ah',
                  stores: { slug: 'ah' },
                  prices: [{ price_cents: 99 }],
                },
              },
            ],
          },
        ],
      })

      const service = new ListService(client)
      const results = await service.searchProducts('melk')

      expect(results).toHaveLength(2)
      expect(results[0].unifiedProductId).toBe('u-milk')
      expect(results[0].canonicalName).toBe('Volle Melk 1L')
      expect(results[0].category).toBe('Zuivel')
      expect(results[0].stores).toHaveLength(2)
      expect(results[0].stores[0].storeSlug).toBe('ah')
      expect(results[0].stores[0].priceCents).toBe(119)
    })

    it('respects limit parameter', async () => {
      const { client } = createMockSupabase({
        searchResults: [
          {
            id: 'u-1',
            canonical_name: 'Melk A',
            canonical_category: null,
            product_mappings: [],
          },
          {
            id: 'u-2',
            canonical_name: 'Melk B',
            canonical_category: null,
            product_mappings: [],
          },
          {
            id: 'u-3',
            canonical_name: 'Melk C',
            canonical_category: null,
            product_mappings: [],
          },
        ],
      })

      const service = new ListService(client)
      const results = await service.searchProducts('melk', 2)

      expect(results).toHaveLength(2)
    })

    it('returns empty array on error', async () => {
      const { client } = createMockSupabase({
        error: { message: 'Search failed' },
      })

      const service = new ListService(client)
      const results = await service.searchProducts('melk')
      expect(results).toEqual([])
    })
  })

  // =========================================================================
  // optimizeList
  // =========================================================================
  describe('optimizeList', () => {
    it('builds correct OptimizationInput from list items and runs optimizer', async () => {
      // Create a mock that handles both user_lists (getList) and product_mappings (optimizer)
      const listData = {
        id: 'list-1',
        name: 'Test List',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        list_items: [
          { id: 'item-1', product_name: 'Milk', quantity: 2, unified_product_id: 'u-milk' },
          { id: 'item-2', product_name: 'Bread', quantity: 1, unified_product_id: 'u-bread' },
          { id: 'item-3', product_name: 'Custom Item', quantity: 1, unified_product_id: null },
        ],
      }

      const priceRows = [
        {
          unified_product_id: 'u-milk',
          product_id: 'p-ah-milk',
          products: { id: 'p-ah-milk', name: 'Melk', store_id: 's-ah', stores: { slug: 'ah', name: 'Albert Heijn' } },
          prices: [{ price_cents: 119 }],
        },
        {
          unified_product_id: 'u-milk',
          product_id: 'p-jumbo-milk',
          products: { id: 'p-jumbo-milk', name: 'Melk', store_id: 's-jumbo', stores: { slug: 'jumbo', name: 'Jumbo' } },
          prices: [{ price_cents: 109 }],
        },
        {
          unified_product_id: 'u-bread',
          product_id: 'p-ah-bread',
          products: { id: 'p-ah-bread', name: 'Brood', store_id: 's-ah', stores: { slug: 'ah', name: 'Albert Heijn' } },
          prices: [{ price_cents: 239 }],
        },
        {
          unified_product_id: 'u-bread',
          product_id: 'p-jumbo-bread',
          products: { id: 'p-jumbo-bread', name: 'Brood', store_id: 's-jumbo', stores: { slug: 'jumbo', name: 'Jumbo' } },
          prices: [{ price_cents: 249 }],
        },
      ]

      // Build a custom mock that handles multiple tables
      const client: SupabaseClient = {
        from: vi.fn((table: string) => {
          if (table === 'user_lists') {
            const builder: Record<string, unknown> = {}
            builder.select = vi.fn(() => {
              const selectBuilder: Record<string, unknown> = {}
              selectBuilder.eq = vi.fn(() => {
                const eqBuilder: Record<string, unknown> = {}
                eqBuilder.single = vi.fn(() => ({
                  then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
                    Promise.resolve({ data: listData, error: null }).then(resolve, reject),
                }))
                return eqBuilder
              })
              return selectBuilder
            })
            builder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: null, error: null }).then(resolve, reject)
            return builder as unknown as SupabaseQueryBuilder
          }

          if (table === 'product_mappings') {
            const builder: Record<string, unknown> = {}
            builder.select = vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
                  Promise.resolve({ data: priceRows, error: null }).then(resolve, reject),
              }),
            })
            builder.then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: null, error: null }).then(resolve, reject)
            return builder as unknown as SupabaseQueryBuilder
          }

          // Default builder for other tables
          const builder: Record<string, unknown> = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
              Promise.resolve({ data: null, error: null }).then(resolve, reject),
          }
          return builder as unknown as SupabaseQueryBuilder
        }),
      }

      const service = new ListService(client)
      const result = await service.optimizeList('list-1')

      // Should only include items with unified_product_id (not 'Custom Item')
      expect(result.assignments).toHaveLength(2)
      expect(result.totalCostCents).toBeGreaterThan(0)

      // Milk should be assigned to jumbo (109 < 119), Bread to ah (239 < 249)
      const milkAssignment = result.assignments.find((a) => a.unifiedProductId === 'u-milk')
      const breadAssignment = result.assignments.find((a) => a.unifiedProductId === 'u-bread')

      expect(milkAssignment?.storeSlug).toBe('jumbo')
      expect(milkAssignment?.priceCents).toBe(109)
      expect(milkAssignment?.quantity).toBe(2)

      expect(breadAssignment?.storeSlug).toBe('ah')
      expect(breadAssignment?.priceCents).toBe(239)
    })

    it('throws when list is not found', async () => {
      const { client } = createMockSupabase()

      const service = new ListService(client)
      await expect(service.optimizeList('nonexistent')).rejects.toThrow('List not found')
    })
  })

  // =========================================================================
  // getList with items
  // =========================================================================
  describe('getList', () => {
    it('joins list_items correctly', async () => {
      const { client } = createMockSupabase({
        lists: [
          {
            id: 'list-1',
            name: 'My List',
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T12:00:00Z',
            list_items: [
              { id: 'item-1', product_name: 'Melk', quantity: 1, unified_product_id: 'u-milk' },
              { id: 'item-2', product_name: 'Brood', quantity: 2, unified_product_id: null },
            ],
          },
        ],
      })

      const service = new ListService(client)
      const result = await service.getList('list-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('list-1')
      expect(result!.name).toBe('My List')
      expect(result!.items).toHaveLength(2)
      expect(result!.items[0].productName).toBe('Melk')
      expect(result!.items[0].quantity).toBe(1)
      expect(result!.items[0].unifiedProductId).toBe('u-milk')
      expect(result!.items[1].productName).toBe('Brood')
      expect(result!.items[1].unifiedProductId).toBeNull()
    })

    it('returns null when list is not found', async () => {
      const { client } = createMockSupabase()

      const service = new ListService(client)
      const result = await service.getList('nonexistent')
      expect(result).toBeNull()
    })
  })

  // =========================================================================
  // getAllLists
  // =========================================================================
  describe('getAllLists', () => {
    it('returns all lists without items', async () => {
      const { client } = createMockSupabase({
        lists: [
          { id: 'list-1', name: 'List A', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T10:00:00Z' },
          { id: 'list-2', name: 'List B', created_at: '2024-01-16T10:00:00Z', updated_at: '2024-01-16T10:00:00Z' },
        ],
      })

      const service = new ListService(client)
      const result = await service.getAllLists()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('List A')
      expect(result[1].name).toBe('List B')
      expect(result[0].items).toEqual([])
    })
  })

  // =========================================================================
  // deleteList
  // =========================================================================
  describe('deleteList', () => {
    it('deletes without error (cascade to items)', async () => {
      const { client } = createMockSupabase()

      const service = new ListService(client)
      await expect(service.deleteList('list-1')).resolves.toBeUndefined()
      expect(client.from).toHaveBeenCalledWith('user_lists')
    })

    it('throws on error', async () => {
      const { client } = createMockSupabase({
        error: { message: 'Delete failed' },
      })

      const service = new ListService(client)
      await expect(service.deleteList('list-1')).rejects.toThrow('Delete failed')
    })
  })
})
