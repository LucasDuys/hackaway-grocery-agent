"use client";

import type { StoreSlug } from "@/lib/scrapers/types";
import { PriceBadge } from "./price-badge";
import { StoreLogo } from "./store-logo";

interface PriceEntry {
  storeSlug: string;
  priceCents: number;
  pricePerUnit?: string;
  isOnSale?: boolean;
  originalPriceCents?: number;
}

interface PriceComparisonProps {
  prices: PriceEntry[];
}

function formatEur(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `EUR ${euros}`;
}

export function PriceComparison({ prices }: PriceComparisonProps) {
  if (prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => a.priceCents - b.priceCents);
  const cheapest = sorted[0].priceCents;
  const mostExpensive = sorted[sorted.length - 1].priceCents;
  const savingsCents = mostExpensive - cheapest;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {sorted.map((entry, index) => {
          const isCheapest = index === 0 && sorted.length > 1;

          return (
            <div
              key={entry.storeSlug}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                isCheapest
                  ? "border-[var(--success)] bg-[var(--success-light)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <StoreLogo slug={entry.storeSlug as StoreSlug} size="sm" />
              <PriceBadge
                priceCents={entry.priceCents}
                originalPriceCents={entry.originalPriceCents}
                pricePerUnit={entry.pricePerUnit}
                size="sm"
              />
            </div>
          );
        })}
      </div>

      {savingsCents > 0 && (
        <p className="text-xs font-medium text-[var(--success)]">
          Save {formatEur(savingsCents)} vs most expensive
        </p>
      )}
    </div>
  );
}
