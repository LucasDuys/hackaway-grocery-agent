"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { StoreLogo } from "@/components/store-logo";
import type { StoreSlug } from "@/lib/scrapers/types";

interface AlertData {
  id: string;
  productId: string;
  targetPriceCents: number;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
  productName?: string;
  currentPriceCents?: number;
  storeSlug?: string;
}

interface ProductSearchResult {
  id: string;
  name: string;
  storeSlug?: string;
  priceCents?: number;
}

function formatEur(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create alert form state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [targetPrice, setTargetPrice] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searching, setSearching] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const json = await res.json() as { alerts: AlertData[] };
      setAlerts(json.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery.trim())}&limit=5`);
      if (!res.ok) throw new Error("Search failed");
      const results = await res.json() as ProductSearchResult[];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleCreateAlert = useCallback(async () => {
    if (!selectedProduct || !targetPrice) return;

    const targetCents = Math.round(parseFloat(targetPrice.replace(",", ".")) * 100);
    if (isNaN(targetCents) || targetCents <= 0) {
      setError("Please enter a valid target price");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          targetPriceCents: targetCents,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create alert");
      }

      // Reset form and refresh
      setSelectedProduct(null);
      setSearchQuery("");
      setSearchResults([]);
      setTargetPrice("");
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setIsCreating(false);
    }
  }, [selectedProduct, targetPrice, fetchAlerts]);

  const handleDeleteAlert = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete alert");
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete alert");
    }
  }, []);

  const activeAlerts = alerts.filter((a) => a.isActive);
  const triggeredAlerts = alerts.filter((a) => !a.isActive && a.triggeredAt);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Price Alerts
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Get notified when prices drop to your target
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-2 font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Create Alert Form */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Create Alert
            </h2>

            <div className="mt-4 space-y-4">
              {/* Product search */}
              <div>
                <label
                  htmlFor="product-search"
                  className="block text-sm font-medium text-[var(--text-secondary)]"
                >
                  Search for a product
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="product-search"
                    type="text"
                    placeholder="e.g. melk, kaas, brood..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching}
                    className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {searching ? "..." : "Search"}
                  </button>
                </div>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] divide-y divide-[var(--border-light)]">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(product);
                        setSearchResults([]);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent-light)] ${
                        selectedProduct?.id === product.id ? "bg-[var(--accent-light)]" : ""
                      }`}
                    >
                      {product.storeSlug && (
                        <StoreLogo slug={product.storeSlug as StoreSlug} size="sm" />
                      )}
                      <span className="flex-1 truncate text-[var(--text-primary)]">
                        {product.name}
                      </span>
                      {product.priceCents != null && (
                        <span className="shrink-0 text-xs text-[var(--text-muted)]">
                          {formatEur(product.priceCents)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected product */}
              {selectedProduct && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-light)] px-3 py-2">
                  <span className="text-sm font-medium text-[var(--accent)]">
                    Selected:
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {selectedProduct.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="ml-auto text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Target price */}
              <div>
                <label
                  htmlFor="target-price"
                  className="block text-sm font-medium text-[var(--text-secondary)]"
                >
                  Target price (EUR)
                </label>
                <input
                  id="target-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 1,50"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="mt-1 w-full max-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateAlert}
                disabled={!selectedProduct || !targetPrice || isCreating}
                className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Alert"}
              </button>
            </div>
          </section>

          {/* Triggered Alerts */}
          {triggeredAlerts.length > 0 && (
            <section className="rounded-2xl border border-[var(--success)] bg-[var(--success-light)] p-4 sm:p-6">
              <h2 className="text-lg font-bold text-[var(--success)]">
                Triggered Alerts
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Prices dropped to your target
              </p>

              <div className="mt-4 divide-y divide-[var(--border-light)]">
                {triggeredAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {alert.storeSlug && (
                          <StoreLogo slug={alert.storeSlug as StoreSlug} size="sm" />
                        )}
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {alert.productName ?? alert.productId}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">
                          Target: {formatEur(alert.targetPriceCents)}
                        </span>
                        {alert.currentPriceCents != null && (
                          <span className="font-semibold text-[var(--success)]">
                            Now: {formatEur(alert.currentPriceCents)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="shrink-0 ml-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-light)] hover:text-[var(--danger)] hover:border-[var(--danger)]"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active Alerts */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Active Alerts
            </h2>

            {loading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 animate-pulse rounded bg-[var(--border)]" />
                      <div className="h-4 w-32 animate-pulse rounded bg-[var(--border)]" />
                    </div>
                    <div className="h-4 w-20 animate-pulse rounded bg-[var(--border)]" />
                  </div>
                ))}
              </div>
            ) : activeAlerts.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                No active alerts. Create one above to get notified when prices drop.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-[var(--border-light)]">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {alert.storeSlug && (
                          <StoreLogo slug={alert.storeSlug as StoreSlug} size="sm" />
                        )}
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {alert.productName ?? alert.productId}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">
                          Target: {formatEur(alert.targetPriceCents)}
                        </span>
                        {alert.currentPriceCents != null && (
                          <span className="text-[var(--text-secondary)]">
                            Current: {formatEur(alert.currentPriceCents)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="shrink-0 ml-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-light)] hover:text-[var(--danger)] hover:border-[var(--danger)]"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
