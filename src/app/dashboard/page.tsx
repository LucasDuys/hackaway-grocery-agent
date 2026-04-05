"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { StoreLogo } from "@/components/store-logo";
import type { StoreSlug } from "@/lib/scrapers/types";
import type { PriceChange } from "@/lib/prices/types";

interface StoreComparison {
  storeSlug: StoreSlug;
  storeName: string;
  totalCents: number;
  missingItems: number;
}

interface TrackedProduct {
  id: string;
  name: string;
  storeSlug: StoreSlug;
  currentPriceCents: number;
  trend7d: "rising" | "falling" | "stable";
}

interface DashboardData {
  savingsCents: number;
  optimizedTotalCents: number;
  storeComparisons: StoreComparison[];
  trackedProducts: TrackedProduct[];
  deals: PriceChange[];
  cheapestByCategory: { category: string; storeSlug: StoreSlug; storeName: string }[];
}

function formatEur(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function TrendIndicator({ trend }: { trend: "rising" | "falling" | "stable" }) {
  if (trend === "rising") {
    return <span className="text-[var(--danger)] font-semibold">^ Up</span>;
  }
  if (trend === "falling") {
    return <span className="text-[var(--success)] font-semibold">v Down</span>;
  }
  return <span className="text-[var(--text-muted)] font-semibold">-- Stable</span>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // In production this would fetch from API routes.
      // For now, use demo data to render the dashboard.
      const demo: DashboardData = {
        savingsCents: 1247,
        optimizedTotalCents: 4823,
        storeComparisons: [
          { storeSlug: "ah", storeName: "Albert Heijn", totalCents: 5670, missingItems: 0 },
          { storeSlug: "jumbo", storeName: "Jumbo", totalCents: 5420, missingItems: 0 },
          { storeSlug: "lidl", storeName: "Lidl", totalCents: 4980, missingItems: 2 },
          { storeSlug: "aldi", storeName: "Aldi", totalCents: 5100, missingItems: 1 },
          { storeSlug: "plus", storeName: "Plus", totalCents: 5350, missingItems: 0 },
          { storeSlug: "picnic", storeName: "Picnic", totalCents: 5200, missingItems: 3 },
        ],
        trackedProducts: [
          { id: "1", name: "Halfvolle melk 1L", storeSlug: "ah", currentPriceCents: 119, trend7d: "stable" },
          { id: "2", name: "Pindakaas 350g", storeSlug: "jumbo", currentPriceCents: 249, trend7d: "falling" },
          { id: "3", name: "Biologisch brood", storeSlug: "lidl", currentPriceCents: 189, trend7d: "rising" },
          { id: "4", name: "Kipfilet 500g", storeSlug: "ah", currentPriceCents: 549, trend7d: "falling" },
          { id: "5", name: "Appels 1kg", storeSlug: "plus", currentPriceCents: 199, trend7d: "stable" },
        ],
        deals: [
          { productId: "d1", productName: "Douwe Egberts Koffie", storeSlug: "ah", oldPriceCents: 899, newPriceCents: 599, changeCents: 300, changePercent: 33, direction: "down" },
          { productId: "d2", productName: "Optimel Yoghurt", storeSlug: "jumbo", oldPriceCents: 199, newPriceCents: 149, changeCents: 50, changePercent: 25, direction: "down" },
          { productId: "d3", productName: "Heineken 6-pack", storeSlug: "lidl", oldPriceCents: 599, newPriceCents: 449, changeCents: 150, changePercent: 25, direction: "down" },
        ],
        cheapestByCategory: [
          { category: "Zuivel", storeSlug: "lidl", storeName: "Lidl" },
          { category: "Brood", storeSlug: "aldi", storeName: "Aldi" },
          { category: "Vlees", storeSlug: "lidl", storeName: "Lidl" },
          { category: "Groente & Fruit", storeSlug: "plus", storeName: "Plus" },
          { category: "Dranken", storeSlug: "jumbo", storeName: "Jumbo" },
        ],
      };

      setData(demo);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !data) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-[var(--text-muted)]">Loading dashboard...</p>
        </main>
      </div>
    );
  }

  const maxStoreCost = Math.max(...data.storeComparisons.map((s) => s.totalCents));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* Savings Hero */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--success-light)] p-6 text-center sm:p-8">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Total savings this month
            </p>
            <p className="mt-2 text-5xl font-bold text-[var(--success)] sm:text-6xl">
              {formatEur(data.savingsCents)}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Optimized basket: {formatEur(data.optimizedTotalCents)}
            </p>
          </section>

          {/* Store Comparison Bar Chart */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Store Comparison
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Cost of your basket at each store vs optimized
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
                    style={{ width: `${(data.optimizedTotalCents / maxStoreCost) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right text-sm font-semibold text-[var(--text-primary)]">
                  {formatEur(data.optimizedTotalCents)}
                </span>
              </div>

              {data.storeComparisons
                .sort((a, b) => a.totalCents - b.totalCents)
                .map((store) => (
                  <div key={store.storeSlug} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <StoreLogo slug={store.storeSlug} size="sm" />
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-7 rounded-md bg-[var(--accent-light)] border border-[var(--border)]"
                        style={{ width: `${(store.totalCents / maxStoreCost) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-medium text-[var(--text-secondary)]">
                      {formatEur(store.totalCents)}
                    </span>
                  </div>
                ))}
            </div>
          </section>

          {/* Price Trends + Deals grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Price Trends */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Price Trends
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Tracked products with 7-day trend
              </p>

              <div className="mt-4 divide-y divide-[var(--border-light)]">
                {data.trackedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <StoreLogo slug={product.storeSlug} size="sm" />
                      <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {product.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatEur(product.currentPriceCents)}
                      </span>
                      <TrendIndicator trend={product.trend7d} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Deals of the Week */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Deals of the Week
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Biggest price drops this week
              </p>

              <div className="mt-4 divide-y divide-[var(--border-light)]">
                {data.deals.map((deal) => (
                  <div key={deal.productId} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <StoreLogo slug={deal.storeSlug as StoreSlug} size="sm" />
                      <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {deal.productName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-sm text-[var(--text-muted)] line-through">
                        {formatEur(deal.oldPriceCents)}
                      </span>
                      <span className="text-sm font-bold text-[var(--success)]">
                        {formatEur(deal.newPriceCents)}
                      </span>
                      <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]">
                        -{deal.changePercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Cheapest Store by Category */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Cheapest Store This Week
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Which store is cheapest by category
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.cheapestByCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <StoreLogo slug={item.storeSlug} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {item.category}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {item.storeName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
