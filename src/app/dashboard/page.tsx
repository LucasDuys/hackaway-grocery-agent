"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { StoreLogo } from "@/components/store-logo";
import type { StoreSlug } from "@/lib/scrapers/types";

interface StoreBreakdownItem {
  storeSlug: string;
  storeName: string;
  productCount: number;
  avgPriceCents: number;
}

interface CheapestProduct {
  name: string;
  storeSlug: string;
  storeName: string;
  priceCents: number;
  unitSize: string;
}

interface Deal {
  name: string;
  storeSlug: string;
  storeName: string;
  priceCents: number;
  originalPriceCents: number;
  savingsCents: number;
  savingsPercent: number;
  unitSize: string;
}

interface StoreComparison {
  storeSlug: string;
  storeName: string;
  totalCents: number;
  itemsFound: number;
  itemsMissing: number;
}

interface SavingsSummary {
  optimizedTotalCents: number;
  cheapestSingleStoreCents: number;
  savingsCents: number;
  savingsPercent: number;
  basketSize: number;
  optimizedItemsFound: number;
}

interface DashboardData {
  totalProducts: number;
  storeBreakdown: StoreBreakdownItem[];
  cheapestProducts: CheapestProduct[];
  deals: Deal[];
  storeComparisons: StoreComparison[];
  savingsSummary: SavingsSummary;
}

function formatEur(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        throw new Error("Failed to load dashboard data");
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-[var(--text-muted)]">Loading dashboard...</p>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--danger)]">
              {error || "Failed to load dashboard data"}
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                loadData();
              }}
              className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  const maxStoreCost =
    data.storeComparisons.length > 0
      ? Math.max(...data.storeComparisons.map((s) => s.totalCents))
      : 1;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* Savings Hero */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--success-light)] p-6 text-center sm:p-8">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Smart shopping saves you
            </p>
            <p className="mt-2 text-5xl font-bold text-[var(--success)] sm:text-6xl">
              {formatEur(data.savingsSummary.savingsCents)}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Optimized basket: {formatEur(data.savingsSummary.optimizedTotalCents)}
              {" vs cheapest single store: "}
              {formatEur(data.savingsSummary.cheapestSingleStoreCents)}
              {" ("}
              {data.savingsSummary.savingsPercent}% savings)
            </p>
          </section>

          {/* Overview Stats */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">Total Products</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{data.totalProducts}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">Stores Tracked</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{data.storeBreakdown.length}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">Active Deals</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{data.deals.length}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">Basket Items Compared</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{data.savingsSummary.optimizedItemsFound}/{data.savingsSummary.basketSize}</p>
            </div>
          </section>

          {/* Store Comparison Bar Chart */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Store Comparison
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Cost of a sample basket at each store vs optimized
            </p>

            <div className="mt-6 space-y-3">
              {/* Optimized row */}
              <div className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <span className="inline-flex items-center justify-center rounded-md bg-[var(--success)] px-2 py-1 text-xs font-bold text-white">
                    Optimized
                  </span>
                </div>
                <div className="flex-1">
                  <div
                    className="h-7 rounded-md bg-[var(--success)]"
                    style={{ width: `${(data.savingsSummary.optimizedTotalCents / maxStoreCost) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right text-sm font-semibold text-[var(--text-primary)]">
                  {formatEur(data.savingsSummary.optimizedTotalCents)}
                </span>
              </div>

              {data.storeComparisons
                .filter((s) => s.itemsFound > 0)
                .sort((a, b) => a.totalCents - b.totalCents)
                .map((store) => (
                  <div key={store.storeSlug} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <StoreLogo slug={store.storeSlug as StoreSlug} size="sm" />
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-7 rounded-md bg-[var(--accent-light)] border border-[var(--border)]"
                        style={{ width: `${(store.totalCents / maxStoreCost) * 100}%` }}
                      />
                    </div>
                    <div className="w-24 text-right">
                      <span className="text-sm font-medium text-[var(--text-secondary)]">
                        {formatEur(store.totalCents)}
                      </span>
                      {store.itemsMissing > 0 && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {store.itemsMissing} missing
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Store Breakdown + Deals grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Store Breakdown */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Products by Store
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Product count and average price
              </p>

              <div className="mt-4 divide-y divide-[var(--border-light)]">
                {data.storeBreakdown.map((store) => (
                  <div key={store.storeSlug} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <StoreLogo slug={store.storeSlug as StoreSlug} size="sm" />
                      <div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {store.storeName}
                        </span>
                        <p className="text-xs text-[var(--text-muted)]">
                          {store.productCount} products
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      avg {formatEur(store.avgPriceCents)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Deals */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Best Deals
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Products on sale, sorted by savings
              </p>

              <div className="mt-4 divide-y divide-[var(--border-light)]">
                {data.deals.length === 0 ? (
                  <p className="py-4 text-sm text-[var(--text-muted)]">
                    No deals found at the moment.
                  </p>
                ) : (
                  data.deals.slice(0, 10).map((deal, index) => (
                    <div key={`${deal.storeSlug}-${deal.name}-${index}`} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <StoreLogo slug={deal.storeSlug as StoreSlug} size="sm" />
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {deal.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm text-[var(--text-muted)] line-through">
                          {formatEur(deal.originalPriceCents)}
                        </span>
                        <span className="text-sm font-bold text-[var(--success)]">
                          {formatEur(deal.priceCents)}
                        </span>
                        <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]">
                          -{deal.savingsPercent}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Cheapest Products */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Top 10 Cheapest Products
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Lowest priced items across all stores
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {data.cheapestProducts.map((product, index) => (
                <div
                  key={`${product.storeSlug}-${product.name}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <StoreLogo slug={product.storeSlug as StoreSlug} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {product.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {product.unitSize}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[var(--success)]">
                    {formatEur(product.priceCents)}
                  </span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
