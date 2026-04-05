"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { StoreFilter } from "@/components/store-filter";
import { StoreLogo } from "@/components/store-logo";
import type { StoreSlug } from "@/lib/scrapers/types";
import type {
  OptimizationResult,
  StoreAssignment,
  StoreBreakdown,
  SingleStoreComparison,
} from "@/lib/optimizer/types";
import type {
  ShoppingList,
  ShoppingListItem,
  ProductSearchResult,
} from "@/lib/lists/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatEur(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `EUR ${euros}`;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function SearchAutocomplete({
  listId,
  onAdd,
}: {
  listId: string;
  onAdd: (item: ShoppingListItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    async function search() {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`
        );
        if (!res.ok) return;
        const data: ProductSearchResult[] = await res.json();
        if (!cancelled) {
          setResults(data);
          setShowDropdown(data.length > 0);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }

    search();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSelect(product: ProductSearchResult) {
    setShowDropdown(false);
    setQuery("");
    setResults([]);

    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: product.canonicalName,
          quantity: 1,
          unifiedProductId: product.unifiedProductId,
        }),
      });

      if (!res.ok) return;
      const item: ShoppingListItem = await res.json();
      onAdd(item);
    } catch {
      // Silently fail -- user can retry
    }
  }

  function cheapestPrice(product: ProductSearchResult): number | null {
    if (product.stores.length === 0) return null;
    return Math.min(...product.stores.map((s) => s.priceCents));
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-light)]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setShowDropdown(true);
          }}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          placeholder="Search products to add..."
          className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        {isSearching && (
          <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        )}
      </div>

      <AnimatePresence>
        {showDropdown && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
          >
            {results.map((product) => {
              const cheap = cheapestPrice(product);
              return (
                <button
                  key={product.unifiedProductId}
                  type="button"
                  onClick={() => handleSelect(product)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {product.canonicalName}
                    </p>
                    {product.category && (
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {product.category}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.stores.map((s) => (
                        <StoreLogo
                          key={s.storeSlug}
                          slug={s.storeSlug as StoreSlug}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                  {cheap != null && (
                    <span className="shrink-0 text-sm font-bold text-[var(--text-primary)]">
                      {formatEur(cheap)}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListItemRow({
  item,
  listId,
  onQuantityChange,
  onRemove,
  assignment,
}: {
  item: ShoppingListItem;
  listId: string;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  assignment?: StoreAssignment;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateQuantity(newQty: number) {
    if (newQty < 1 || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, quantity: newQty }),
      });
      if (res.ok) onQuantityChange(item.id, newQty);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRemove() {
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (res.ok) onRemove(item.id);
    } catch {
      // Silently fail
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
    >
      {/* Product name + assignment */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {item.productName}
        </p>
        {assignment && (
          <div className="mt-1 flex items-center gap-1.5">
            <StoreLogo slug={assignment.storeSlug as StoreSlug} size="sm" />
            <span className="text-xs text-[var(--text-secondary)]">
              {formatEur(assignment.priceCents)}
            </span>
          </div>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => updateQuantity(item.quantity - 1)}
          disabled={item.quantity <= 1 || isUpdating}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-accent)] disabled:opacity-30"
        >
          -
        </button>
        <span className="w-8 text-center text-sm font-semibold text-[var(--text-primary)]">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => updateQuantity(item.quantity + 1)}
          disabled={isUpdating}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-accent)] disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={handleRemove}
        className="shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-light)] hover:text-[var(--danger)]"
        title="Remove item"
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

function StoreBreakdownBar({ breakdown }: { breakdown: StoreBreakdown[] }) {
  const total = breakdown.reduce((sum, b) => sum + b.subtotalCents, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
        Store breakdown
      </h3>

      {/* Stacked bar */}
      <div className="flex h-6 w-full overflow-hidden rounded-full">
        {breakdown.map((b) => {
          const pct = (b.subtotalCents / total) * 100;
          if (pct < 1) return null;
          return (
            <div
              key={b.storeSlug}
              className="flex items-center justify-center text-[9px] font-bold text-white"
              style={{
                width: `${pct}%`,
                ...getStoreBarStyle(b.storeSlug as StoreSlug),
              }}
              title={`${b.storeName}: ${formatEur(b.subtotalCents)} (${Math.round(pct)}%)`}
            >
              {pct > 12 ? `${Math.round(pct)}%` : ""}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {breakdown.map((b) => (
          <div key={b.storeSlug} className="flex items-center gap-1.5">
            <StoreLogo slug={b.storeSlug as StoreSlug} size="sm" />
            <span className="text-xs text-[var(--text-secondary)]">
              {formatEur(b.subtotalCents)} ({b.itemCount}{" "}
              {b.itemCount === 1 ? "item" : "items"})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStoreBarStyle(slug: StoreSlug): React.CSSProperties {
  const map: Record<StoreSlug, string> = {
    ah: "#00a0e2",
    jumbo: "#ffc800",
    lidl: "#0050aa",
    picnic: "#ff6600",
    plus: "#00a651",
    aldi: "#00205b",
  };
  return { background: map[slug] || "#888" };
}

function SingleStoreCard({
  comparison,
  optimizedTotal,
}: {
  comparison: SingleStoreComparison;
  optimizedTotal: number;
}) {
  const diff = comparison.totalCents - optimizedTotal;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <StoreLogo slug={comparison.storeSlug as StoreSlug} size="md" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {comparison.storeName}
        </span>
      </div>
      <p className="text-lg font-bold text-[var(--text-primary)]">
        {formatEur(comparison.totalCents)}
      </p>
      {comparison.missingItems > 0 && (
        <p className="text-xs text-[var(--warning)]">
          {comparison.missingItems} item
          {comparison.missingItems > 1 ? "s" : ""} unavailable
        </p>
      )}
      {diff > 0 && (
        <p className="text-xs font-medium text-[var(--danger)]">
          +{formatEur(diff)} more
        </p>
      )}
      {diff === 0 && (
        <p className="text-xs font-medium text-[var(--success)]">
          Same as optimized
        </p>
      )}
    </div>
  );
}

function OptimizationPanel({ result }: { result: OptimizationResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 rounded-xl border border-[var(--success)] bg-[var(--success-light)] p-6"
    >
      {/* Summary header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Optimization Result
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Best prices across{" "}
            {result.storeBreakdown.length}{" "}
            {result.storeBreakdown.length === 1 ? "store" : "stores"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {formatEur(result.totalCostCents)}
          </p>
          {result.savingsCents > 0 && (
            <p className="text-sm font-semibold text-[var(--success)]">
              You save {formatEur(result.savingsCents)}
            </p>
          )}
        </div>
      </div>

      {/* Per-item assignments */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Item assignments
        </h3>
        {result.assignments.map((a) => (
          <div
            key={`${a.unifiedProductId}-${a.storeSlug}`}
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <StoreLogo slug={a.storeSlug as StoreSlug} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
              {a.productName}
              {a.quantity > 1 && (
                <span className="text-[var(--text-muted)]">
                  {" "}
                  x{a.quantity}
                </span>
              )}
            </span>
            <span className="shrink-0 text-sm font-semibold text-[var(--text-primary)]">
              {formatEur(a.priceCents * a.quantity)}
            </span>
          </div>
        ))}
      </div>

      {/* Store breakdown bar */}
      <StoreBreakdownBar breakdown={result.storeBreakdown} />

      {/* Single-store comparisons */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Single-store comparison
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.singleStoreComparisons.map((c) => (
            <SingleStoreCard
              key={c.storeSlug}
              comparison={c}
              optimizedTotal={result.totalCostCents}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function ListEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([
    "ah",
    "jumbo",
    "lidl",
    "picnic",
    "plus",
    "aldi",
  ]);
  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`/api/lists/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("List not found");
          return;
        }
        throw new Error("Failed to load list");
      }
      const data = await res.json();
      // Parse dates from API response
      setList({
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  function handleItemAdded(item: ShoppingListItem) {
    setList((prev) => {
      if (!prev) return prev;
      return { ...prev, items: [...prev.items, item] };
    });
    // Clear optimization when list changes
    setOptimizationResult(null);
  }

  function handleQuantityChange(itemId: string, quantity: number) {
    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      };
    });
    setOptimizationResult(null);
  }

  function handleItemRemoved(itemId: string) {
    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
      };
    });
    setOptimizationResult(null);
  }

  async function handleOptimize() {
    if (!list || list.items.length === 0 || isOptimizing) return;

    setIsOptimizing(true);
    setError(null);

    try {
      const res = await fetch(`/api/lists/${id}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constraints: {
            storeSlugs:
              selectedStores.length > 0 ? selectedStores : undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Optimization failed");
      }

      const result: OptimizationResult = await res.json();
      setOptimizationResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Optimization failed"
      );
    } finally {
      setIsOptimizing(false);
    }
  }

  // Build assignment map for inline display on list items
  const assignmentMap = new Map<string, StoreAssignment>();
  if (optimizationResult) {
    for (const a of optimizationResult.assignments) {
      assignmentMap.set(a.unifiedProductId, a);
    }
  }

  // Calculate running total from cheapest known prices
  const runningTotalCents = list
    ? list.items.reduce((sum, item) => {
        if (item.matchedProduct) {
          return sum + item.matchedProduct.cheapestPriceCents * item.quantity;
        }
        return sum;
      }, 0)
    : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <div className="flex flex-col gap-4">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--surface-accent)]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--surface-accent)]" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-lg bg-[var(--surface-accent)]"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error / not found
  if (error && !list) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <p className="text-lg font-semibold text-[var(--danger)]">{error}</p>
          <Link
            href="/lists"
            className="mt-4 text-sm font-medium text-[var(--accent)] underline"
          >
            Back to lists
          </Link>
        </main>
      </div>
    );
  }

  if (!list) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/lists"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            Lists
          </Link>
          <span className="mx-2 text-sm text-[var(--text-muted)]">/</span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {list.name}
          </span>
        </div>

        {/* List heading */}
        <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
          {list.name}
        </h1>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 rounded-lg border border-[var(--danger)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]"
            >
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-3 font-semibold underline"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search to add items */}
        <div className="mb-6">
          <SearchAutocomplete listId={id} onAdd={handleItemAdded} />
        </div>

        {/* Items list */}
        <div className="mb-6 flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {list.items.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                listId={id}
                onQuantityChange={handleQuantityChange}
                onRemove={handleItemRemoved}
                assignment={
                  item.unifiedProductId
                    ? assignmentMap.get(item.unifiedProductId)
                    : undefined
                }
              />
            ))}
          </AnimatePresence>

          {list.items.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                No items yet. Search above to add products to your list.
              </p>
            </div>
          )}
        </div>

        {/* Running total */}
        {list.items.length > 0 && runningTotalCents > 0 && (
          <div className="mb-6 flex items-baseline justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Estimated total (cheapest per item)
            </span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatEur(runningTotalCents)}
            </span>
          </div>
        )}

        {/* Store filter + optimize */}
        {list.items.length > 0 && (
          <div className="mb-8 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Stores to include
              </p>
              <StoreFilter
                selectedStores={selectedStores}
                onChange={setSelectedStores}
              />
            </div>

            <motion.button
              type="button"
              onClick={handleOptimize}
              disabled={isOptimizing || selectedStores.length === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {isOptimizing ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Optimizing...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                  Optimize
                </>
              )}
            </motion.button>
          </div>
        )}

        {/* Optimization results */}
        {optimizationResult && (
          <OptimizationPanel result={optimizationResult} />
        )}
      </main>
    </div>
  );
}
