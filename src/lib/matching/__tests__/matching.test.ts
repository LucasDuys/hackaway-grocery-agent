import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EanMatcher } from '../ean-matcher'
import { FuzzyMatcher } from '../fuzzy-matcher'
import { normalizeName, normalizeUnit, levenshteinDistance, nameSimilarity } from '../normalizer'
import { OpenFoodFactsClient } from '../openfoodfacts'
import { RateLimiter } from '../../scrapers/rate-limiter'
import type { SupabaseClient, SupabaseQueryBuilder } from '../../scrapers/db-writer'

// Mock the RateLimiter module so wait() resolves immediately
vi.mock('../../scrapers/rate-limiter')
vi.mocked(RateLimiter).mockImplementation(() => ({
  wait: vi.fn().mockResolvedValue(undefined),
  minDelayMs: 0,
  lastRequest: 0,
}) as unknown as RateLimiter)

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(overrides?: {
  singleResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
  selectData?: unknown[]
}): SupabaseQueryBuilder {
  const builder: SupabaseQueryBuilder = {
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      overrides?.singleResult ?? { data: { id: 'unified-1' }, error: null }
    ),
    then: undefined as unknown as Promise<unknown>['then'],
  }

  const thenResult = { data: overrides?.selectData ?? null, error: null }
  ;(builder as Record<string, unknown>).then = (
    resolve: (val: unknown) => void,
    reject?: (err: unknown) => void,
  ) => {
    return Promise.resolve(thenResult).then(resolve, reject)
  }

  return builder
}

function createMockSupabase(builderByTable?: Record<string, SupabaseQueryBuilder>): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (builderByTable && builderByTable[table]) {
        return builderByTable[table]
      }
      return createMockQueryBuilder()
    }),
  }
}

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
    bytes: vi.fn(),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Normalizer tests
// ---------------------------------------------------------------------------

describe('Normalizer', () => {
  describe('normalizeName', () => {
    it('lowercases and trims', () => {
      expect(normalizeName('  Halfvolle Melk  ')).toBe('halfvolle melk')
    })

    it('strips store prefixes', () => {
      expect(normalizeName('AH Halfvolle Melk')).toBe('halfvolle melk')
      expect(normalizeName('Jumbo Halfvolle Melk')).toBe('halfvolle melk')
      expect(normalizeName('Lidl Yoghurt Naturel')).toBe('yoghurt naturel')
      expect(normalizeName('Plus Appelsap')).toBe('appelsap')
    })

    it('collapses multiple whitespace to single space', () => {
      expect(normalizeName('AH   Halfvolle   Melk')).toBe('halfvolle melk')
      expect(normalizeName('AH  Halfvolle  Melk')).toBe('halfvolle melk')
    })

    it('strips prefix, trailing units, and collapses whitespace together', () => {
      const result = normalizeName('Jumbo    Halfvolle    Melk   1L')
      expect(result).toBe('halfvolle melk')
    })

    it('does not strip prefix if it is part of the product name', () => {
      // "ahornstroop" starts with "ah" but "ah " prefix requires a space
      expect(normalizeName('Ahornstroop')).toBe('ahornstroop')
    })
  })

  describe('normalizeUnit', () => {
    it('converts 1000ml to 1L', () => {
      expect(normalizeUnit('1000', 'ml')).toBe('1L')
    })

    it('converts 1000g to 1KG', () => {
      expect(normalizeUnit('1000', 'g')).toBe('1KG')
    })

    it('keeps 500ml as 500ML', () => {
      expect(normalizeUnit('500', 'ml')).toBe('500ML')
    })

    it('normalizes "liter" to L', () => {
      expect(normalizeUnit('1', 'liter')).toBe('1L')
    })

    it('handles numeric values with comma decimal', () => {
      expect(normalizeUnit('1,5', 'L')).toBe('1.5L')
    })

    it('handles size strings with units embedded', () => {
      expect(normalizeUnit('500ml', 'ml')).toBe('500ML')
    })
  })

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('melk', 'melk')).toBe(0)
    })

    it('returns correct distance for edits', () => {
      expect(levenshteinDistance('melk', 'milk')).toBe(1)
      expect(levenshteinDistance('melk', 'merk')).toBe(1)
    })

    it('returns length of other string when one is empty', () => {
      expect(levenshteinDistance('', 'melk')).toBe(4)
      expect(levenshteinDistance('melk', '')).toBe(4)
    })

    it('computes correct distance for "kitten" vs "sitting"', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    })
  })

  describe('nameSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(nameSimilarity('halfvolle melk', 'halfvolle melk')).toBe(1.0)
    })

    it('returns 0.0 when one string is empty', () => {
      expect(nameSimilarity('', 'halfvolle melk')).toBe(0.0)
    })

    it('returns high similarity for near-identical product names', () => {
      const sim = nameSimilarity('halfvolle melk', 'halfvolle melk 1l')
      expect(sim).toBeGreaterThan(0.6)
    })

    it('returns low similarity for different products', () => {
      const sim = nameSimilarity('halfvolle melk', 'pindakaas')
      expect(sim).toBeLessThan(0.3)
    })
  })
})

// ---------------------------------------------------------------------------
// EAN Matcher tests
// ---------------------------------------------------------------------------

describe('EanMatcher', () => {
  let supabase: SupabaseClient
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('matches same EAN across 3 stores into a single unified product', async () => {
    const products = [
      { id: 'p1', store_id: 'store-ah', name: 'AH Halfvolle Melk', ean: '8710400005568', category: 'Zuivel' },
      { id: 'p2', store_id: 'store-jumbo', name: 'Jumbo Halfvolle Melk', ean: '8710400005568', category: 'Zuivel' },
      { id: 'p3', store_id: 'store-lidl', name: 'Halfvolle Melk', ean: '8710400005568', category: 'Zuivel' },
    ]

    const productsBuilder = createMockQueryBuilder({ selectData: products })
    // Override .eq to still return thenable with data
    ;(productsBuilder.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const eqBuilder = {
        ...productsBuilder,
        then: (
          resolve: (val: unknown) => void,
          reject?: (err: unknown) => void,
        ) => Promise.resolve({ data: products, error: null }).then(resolve, reject),
      }
      return eqBuilder
    })

    const unifiedBuilder = createMockQueryBuilder({
      singleResult: { data: { id: 'unified-abc' }, error: null },
    })
    const mappingsBuilder = createMockQueryBuilder()

    supabase = {
      from: vi.fn((table: string) => {
        if (table === 'products') return productsBuilder
        if (table === 'unified_products') return unifiedBuilder
        if (table === 'product_mappings') return mappingsBuilder
        return createMockQueryBuilder()
      }),
    }

    // Mock Open Food Facts to return product data
    fetchMock.mockResolvedValue(
      mockResponse({
        product: {
          product_name: 'Halfvolle Melk',
          brands: 'Campina',
          categories_tags: ['en:semi-skimmed-milk'],
        },
      })
    )

    const matcher = new EanMatcher(supabase)
    const results = await matcher.match()

    // Should create 3 match results (one per product) all pointing to same unified product
    expect(results).toHaveLength(3)
    expect(results.every((r) => r.unifiedProductId === 'unified-abc')).toBe(true)
    expect(results.every((r) => r.confidence === 1.0)).toBe(true)
    expect(results.every((r) => r.matchMethod === 'exact_ean')).toBe(true)

    // Verify unified_products upsert was called
    expect(supabase.from).toHaveBeenCalledWith('unified_products')
    expect(unifiedBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ean: '8710400005568' }),
      expect.any(Object)
    )

    // Verify product_mappings insert was called 3 times
    expect(mappingsBuilder.upsert).toHaveBeenCalledTimes(3)
  })

  it('does not match products with different EANs', async () => {
    const products = [
      { id: 'p1', store_id: 'store-ah', name: 'AH Halfvolle Melk', ean: '8710400005568', category: 'Zuivel' },
      { id: 'p2', store_id: 'store-jumbo', name: 'Jumbo Volle Melk', ean: '8710400009999', category: 'Zuivel' },
    ]

    const productsBuilder = createMockQueryBuilder({ selectData: products })
    ;(productsBuilder.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const eqBuilder = {
        ...productsBuilder,
        then: (
          resolve: (val: unknown) => void,
          reject?: (err: unknown) => void,
        ) => Promise.resolve({ data: products, error: null }).then(resolve, reject),
      }
      return eqBuilder
    })

    supabase = {
      from: vi.fn((table: string) => {
        if (table === 'products') return productsBuilder
        return createMockQueryBuilder()
      }),
    }

    const matcher = new EanMatcher(supabase)
    const results = await matcher.match()

    // Each EAN has only one product, so no matches
    expect(results).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Fuzzy Matcher tests
// ---------------------------------------------------------------------------

describe('FuzzyMatcher', () => {
  it('matches "AH Halfvolle Melk 1L" with "Jumbo Halfvolle Melk 1 liter" at >= 0.8 confidence', async () => {
    const products = [
      { id: 'p1', store_id: 'store-ah', name: 'AH Halfvolle Melk 1L', ean: null, unit_size: '1', unit_type: 'L', category: 'Zuivel' },
      { id: 'p2', store_id: 'store-jumbo', name: 'Jumbo Halfvolle Melk 1 liter', ean: null, unit_size: '1', unit_type: 'liter', category: 'Zuivel' },
    ]

    // Build a products builder whose chain resolves to { data: products, error: null }
    const productsBuilder: SupabaseQueryBuilder = {
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: ((resolve: (val: unknown) => void, reject?: (err: unknown) => void) =>
        Promise.resolve({ data: products, error: null }).then(resolve, reject)) as Promise<unknown>['then'],
    }

    const unifiedBuilder = createMockQueryBuilder({
      singleResult: { data: { id: 'unified-fuzzy-1' }, error: null },
    })
    const mappingsBuilder = createMockQueryBuilder()

    const supabase: SupabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'products') return productsBuilder
        if (table === 'unified_products') return unifiedBuilder
        if (table === 'product_mappings') return mappingsBuilder
        return createMockQueryBuilder()
      }),
    }

    const matcher = new FuzzyMatcher(supabase)
    const results = await matcher.match()

    expect(results).toHaveLength(2) // Both products linked
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.8)
    expect(results[0].matchMethod).toBe('fuzzy_name_and_size')
  })

  it('does NOT match "Halfvolle melk 1L" with "Volle melk 1L" (different products)', async () => {
    const products = [
      { id: 'p1', store_id: 'store-ah', name: 'Halfvolle melk 1L', ean: null, unit_size: '1', unit_type: 'L', category: 'Zuivel' },
      { id: 'p2', store_id: 'store-jumbo', name: 'Volle melk 1L', ean: null, unit_size: '1', unit_type: 'L', category: 'Zuivel' },
    ]

    const productsBuilder = createMockQueryBuilder({ selectData: products })
    ;(productsBuilder.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const eqBuilder = {
        ...productsBuilder,
        then: (
          resolve: (val: unknown) => void,
          reject?: (err: unknown) => void,
        ) => Promise.resolve({ data: products, error: null }).then(resolve, reject),
      }
      return eqBuilder
    })

    const supabase: SupabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'products') return productsBuilder
        return createMockQueryBuilder()
      }),
    }

    const matcher = new FuzzyMatcher(supabase)
    const results = await matcher.match()

    // "halfvolle melk 1l" vs "volle melk 1l" -- different enough to not match
    expect(results).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Open Food Facts client tests
// ---------------------------------------------------------------------------

describe('OpenFoodFactsClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns product data for a known EAN', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        product: {
          product_name: 'Halfvolle Melk',
          brands: 'Campina',
          categories_tags: ['en:semi-skimmed-milk', 'en:dairy'],
        },
      })
    )

    const client = new OpenFoodFactsClient()
    const result = await client.lookupByEan('8710400005568')

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Halfvolle Melk')
    expect(result!.brand).toBe('Campina')
    expect(result!.category).toBe('en:semi-skimmed-milk')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v2/product/8710400005568.json'
    )
  })

  it('returns null for a 404 response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(null, 404))

    const client = new OpenFoodFactsClient()
    const result = await client.lookupByEan('0000000000000')

    expect(result).toBeNull()
  })

  it('returns null when product data is missing product_name', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        product: {
          product_name: '',
          brands: '',
          categories_tags: [],
        },
      })
    )

    const client = new OpenFoodFactsClient()
    const result = await client.lookupByEan('1111111111111')

    expect(result).toBeNull()
  })

  it('returns null when fetch throws a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'))

    const client = new OpenFoodFactsClient()
    const result = await client.lookupByEan('8710400005568')

    expect(result).toBeNull()
  })
})
