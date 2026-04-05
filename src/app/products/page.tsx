"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { StoreSlug } from "@/lib/scrapers/types";
import { Header } from "@/components/header";
import { StoreFilter } from "@/components/store-filter";
import { ProductCard } from "@/components/product-card";
import { PriceComparison } from "@/components/price-comparison";
import { StoreLogo } from "@/components/store-logo";

interface StoreEntry {
  storeSlug: string;
  priceCents: number;
  productName: string;
}

interface SearchResult {
  unifiedProductId?: string;
  canonicalName: string;
  category: string | null;
  imageUrl?: string | null;
  stores: StoreEntry[];
  cheapestPriceCents?: number;
  storeCount?: number;
}

type SortOption = "cheapest" | "alphabetical" | "stores";

const CATEGORIES = [
  "Zuivel",
  "Brood & Gebak",
  "Groente & Fruit",
  "Vlees & Vis",
  "Dranken",
  "Huishouden",
  "Snacks & Snoep",
  "Ontbijt & Beleg",
  "Diepvries",
  "Pasta & Rijst",
];

function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([
    "ah",
    "jumbo",
    "lidl",
    "picnic",
    "plus",
    "aldi",
  ]);
  const [sortBy, setSortBy] = useState<SortOption>("cheapest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(searchQuery.trim())}&limit=20`,
      );

      if (!res.ok) {
        setResults([]);
        return;
      }

      const data: SearchResult[] = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetch = useCallback(
    debounce((q: string) => fetchProducts(q), 300),
    [fetchProducts],
  );

  useEffect(() => {
    debouncedFetch(query);
  }, [query, debouncedFetch]);

  // Filter by selected stores
  const filteredResults = results.filter((product) => {
    const hasMatchingStore = product.stores.some((s) =>
      selectedStores.includes(s.storeSlug),
    );
    const matchesCategory =
      !selectedCategory ||
      (product.category &&
        product.category.toLowerCase().includes(selectedCategory.toLowerCase()));
    return hasMatchingStore && matchesCategory;
  });

  // Sort results
  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === "cheapest") {
      const aMin = Math.min(...a.stores.map((s) => s.priceCents));
      const bMin = Math.min(...b.stores.map((s) => s.priceCents));
      return aMin - bMin;
    }
    if (sortBy === "alphabetical") {
      return a.canonicalName.localeCompare(b.canonicalName);
    }
    // "stores" -- most stores first
    return b.stores.length - a.stores.length;
  });

  function getCheapestPrice(product: SearchResult): number {
    return Math.min(...product.stores.map((s) => s.priceCents));
  }

  function formatEur(cents: number): string {
    const euros = (cents / 100).toFixed(2).replace(".", ",");
    return `EUR ${euros}`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Category sidebar -- desktop */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            Categories
          </h2>
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedCategory === null
                    ? "bg-[var(--accent-light)] font-medium text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                All categories
              </button>
            </li>
            {CATEGORIES.map((cat) => (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedCategory === cat
                      ? "bg-[var(--accent-light)] font-medium text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-light)]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-[var(--text-muted)]"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products across all stores..."
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
            {isLoading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StoreFilter
              selectedStores={selectedStores}
              onChange={setSelectedStores}
            />

            <div className="flex items-center gap-2">
              {/* Category dropdown -- mobile */}
              <div className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => setCategoryOpen(!categoryOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 6h16" />
                    <path d="M7 12h10" />
                    <path d="M10 18h4" />
                  </svg>
                  {selectedCategory || "Category"}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {categoryOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(null);
                        setCategoryOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        selectedCategory === null
                          ? "bg-[var(--accent-light)] text-[var(--accent)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      All categories
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(
                            selectedCategory === cat ? null : cat,
                          );
                          setCategoryOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          selectedCategory === cat
                            ? "bg-[var(--accent-light)] text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort select */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              >
                <option value="cheapest">Cheapest first</option>
                <option value="alphabetical">A - Z</option>
                <option value="stores">Most stores</option>
              </select>
            </div>
          </div>

          {/* Results */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="mb-3 aspect-square w-full rounded-lg bg-[var(--surface-muted)]" />
                  <div className="mb-2 h-4 w-3/4 rounded bg-[var(--surface-muted)]" />
                  <div className="mb-3 h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
                  <div className="h-5 w-1/3 rounded bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && hasSearched && sortedResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                No products found
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Try a different search term or adjust your filters
              </p>
            </div>
          )}

          {!isLoading && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Search for products
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Compare prices across Albert Heijn, Jumbo, Lidl, Aldi, Plus, and
                Picnic
              </p>
            </div>
          )}

          {!isLoading && sortedResults.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedResults.map((product, index) => {
                const productKey = product.unifiedProductId || `${product.canonicalName}-${index}`;
                const isExpanded = expandedId === productKey;
                const cheapest = getCheapestPrice(product);
                const storeCount = product.stores.filter((s) =>
                  selectedStores.includes(s.storeSlug),
                ).length;

                return (
                  <motion.div
                    key={productKey}
                    layout
                    className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-shadow hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : productKey)
                      }
                      className="flex flex-1 flex-col gap-2 p-4 text-left"
                    >
                      {/* Product image */}
                      <div className="mb-1 flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.canonicalName}
                            width={96}
                            height={96}
                            className="h-24 w-24 rounded-lg object-contain"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const placeholder = document.createElement("div");
                              placeholder.className = "flex h-24 w-24 items-center justify-center rounded-lg bg-[var(--surface-muted)] border border-[var(--border-light)]";
                              const slug = product.stores[0]?.storeSlug || "ah";
                              placeholder.innerHTML = `<span class="text-xs font-semibold text-[var(--text-muted)] uppercase">${slug}</span>`;
                              target.parentElement?.replaceChild(placeholder, target);
                            }}
                          />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-[var(--surface-muted)] border border-[var(--border-light)]">
                            <StoreLogo slug={(product.stores[0]?.storeSlug || "ah") as StoreSlug} size="md" />
                          </div>
                        )}
                      </div>

                      {/* Product name */}
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
                        {product.canonicalName}
                      </h3>

                      {/* Category */}
                      {product.category && (
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          {product.category}
                        </p>
                      )}

                      {/* Price + store count */}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            from
                          </p>
                          <p className="text-base font-bold text-[var(--text-primary)]">
                            {formatEur(cheapest)}
                          </p>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {storeCount} {storeCount === 1 ? "store" : "stores"}
                        </p>
                      </div>

                      {/* Store logos preview */}
                      <div className="flex flex-wrap gap-1 border-t border-[var(--border-light)] pt-2">
                        {[...new Set(product.stores
                          .filter((s) => selectedStores.includes(s.storeSlug))
                          .map((s) => s.storeSlug))]
                          .map((slug) => (
                            <StoreLogo
                              key={slug}
                              slug={slug as StoreSlug}
                              size="sm"
                            />
                          ))}
                      </div>
                    </button>

                    {/* Expanded price comparison */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                              Price comparison
                            </p>
                            <PriceComparison
                              prices={product.stores
                                .filter((s) =>
                                  selectedStores.includes(s.storeSlug),
                                )
                                .map((s) => ({
                                  storeSlug: s.storeSlug,
                                  priceCents: s.priceCents,
                                }))}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
