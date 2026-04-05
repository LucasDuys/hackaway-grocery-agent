/**
 * Text normalization utilities for product matching.
 * Handles Dutch supermarket naming conventions and unit standardization.
 */

/** Store-specific brand prefixes to strip during normalization */
const STORE_PREFIXES = [
  'ah ',
  'jumbo ',
  'lidl ',
  'picnic ',
  'plus ',
  'aldi ',
  'g\'woon ',
  'bonbebe ',
]

/** Common trailing unit patterns to strip from product names */
const UNIT_SUFFIXES = /\s+\d+[\d.,]*\s*(ml|l|liter|litre|cl|dl|g|gr|gram|kg|kilogram|stuk|stuks|st)\.?$/i

/**
 * Normalize a product name for comparison:
 * - lowercase
 * - remove known store brand prefixes
 * - remove trailing unit/size info (e.g., "1L", "500 ml", "1 liter")
 * - collapse multiple whitespace to single space
 * - trim
 */
export function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim()

  for (const prefix of STORE_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length)
      break
    }
  }

  // Strip trailing unit info (e.g., "1l", "500 ml", "1 liter")
  normalized = normalized.replace(UNIT_SUFFIXES, '')

  normalized = normalized.replace(/\s+/g, ' ').trim()
  return normalized
}

/**
 * Normalize a unit size + type to a standard format.
 * Converts e.g. "1000ml" -> "1L", "500g" -> "500g", "1 liter" -> "1L"
 */
export function normalizeUnit(size: string, type: string): string {
  // Clean up size: extract numeric value
  const numMatch = size.match(/[\d.,]+/)
  if (!numMatch) return `${size}${type}`.toLowerCase()

  let value = parseFloat(numMatch[0].replace(',', '.'))
  let unitType = type.toLowerCase().trim()

  // Normalize textual unit descriptions
  if (unitType === 'liter' || unitType === 'litre') unitType = 'l'
  if (unitType === 'ml' || unitType === 'milliliter') unitType = 'ml'
  if (unitType === 'kg' || unitType === 'kilogram') unitType = 'kg'
  if (unitType === 'gram') unitType = 'g'

  // Convert ml to L when >= 1000
  if (unitType === 'ml' && value >= 1000) {
    value = value / 1000
    unitType = 'l'
  }

  // Convert g to kg when >= 1000
  if (unitType === 'g' && value >= 1000) {
    value = value / 1000
    unitType = 'kg'
  }

  // Format: remove trailing .0 for whole numbers
  const formatted = Number.isInteger(value) ? value.toString() : value.toString()
  return `${formatted}${unitType.toUpperCase()}`
}

/**
 * Compute the Levenshtein distance between two strings.
 * Uses the Wagner-Fischer dynamic programming algorithm.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  if (m === 0) return n
  if (n === 0) return m

  // Use two rows instead of full matrix for space efficiency
  let prevRow = new Array(n + 1)
  let currRow = new Array(n + 1)

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        currRow[j - 1] + 1,       // insertion
        prevRow[j] + 1,           // deletion
        prevRow[j - 1] + cost     // substitution
      )
    }
    ;[prevRow, currRow] = [currRow, prevRow]
  }

  return prevRow[n]
}

/**
 * Compute name similarity as a 0-1 score.
 * Combines token overlap (Jaccard) with Levenshtein-based similarity.
 */
export function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  // Token overlap (Jaccard similarity)
  const tokensA = new Set(a.split(' ').sort())
  const tokensB = new Set(b.split(' ').sort())

  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }
  const union = new Set([...tokensA, ...tokensB]).size
  const jaccard = union > 0 ? intersection / union : 0

  // Levenshtein-based similarity
  const maxLen = Math.max(a.length, b.length)
  const dist = levenshteinDistance(a, b)
  const levenSim = 1 - dist / maxLen

  // Weighted combination: 40% Jaccard, 60% Levenshtein
  return 0.4 * jaccard + 0.6 * levenSim
}
