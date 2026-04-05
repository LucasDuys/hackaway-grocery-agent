export interface MatchResult {
  unifiedProductId: string
  productId: string
  confidence: number
  matchMethod: 'exact_ean' | 'fuzzy_name_and_size' | 'fuzzy_name_only' | 'manual'
}

export interface UnifiedProduct {
  id: string
  canonicalName: string
  canonicalCategory: string | null
  ean: string | null
}

export interface MatchStats {
  totalProducts: number
  matched: number
  unmatched: number
  byMethod: Record<string, number>
}
