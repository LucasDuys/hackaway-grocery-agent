"use client";

import type { CartSummary, CartItem } from "@/types";
import { CartItemRow } from "./cart-item";
import { BudgetBar } from "./budget-bar";

interface CartViewProps {
  summary: CartSummary;
}

type Category = "produce" | "dairy" | "proteins" | "pantry" | "other";

const categoryMeta: Record<Category, { label: string }> = {
  produce: { label: "Produce" },
  dairy: { label: "Dairy" },
  proteins: { label: "Proteins" },
  pantry: { label: "Pantry" },
  other: { label: "Other" },
};

const categoryOrder: Category[] = ["produce", "dairy", "proteins", "pantry", "other"];

function categorizeItem(item: CartItem): Category {
  const name = item.name.toLowerCase();
  if (
    name.includes("banana") ||
    name.includes("tomato") ||
    name.includes("avocado") ||
    name.includes("spinach") ||
    name.includes("onion") ||
    name.includes("lettuce") ||
    name.includes("carrot") ||
    name.includes("apple") ||
    name.includes("lemon")
  )
    return "produce";
  if (
    name.includes("milk") ||
    name.includes("cheese") ||
    name.includes("yogurt") ||
    name.includes("butter") ||
    name.includes("cream") ||
    name.includes("egg")
  )
    return "dairy";
  if (
    name.includes("chicken") ||
    name.includes("beef") ||
    name.includes("salmon") ||
    name.includes("pork") ||
    name.includes("tofu") ||
    name.includes("fish")
  )
    return "proteins";
  if (
    name.includes("pasta") ||
    name.includes("rice") ||
    name.includes("bread") ||
    name.includes("olive oil") ||
    name.includes("flour") ||
    name.includes("sauce") ||
    name.includes("soy") ||
    name.includes("garlic") ||
    name.includes("cereal") ||
    name.includes("oat")
  )
    return "pantry";
  return "other";
}

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CartView({ summary }: CartViewProps) {
  const grouped = new Map<Category, CartItem[]>();
  for (const cat of categoryOrder) {
    grouped.set(cat, []);
  }
  for (const item of summary.items) {
    const cat = categorizeItem(item);
    grouped.get(cat)!.push(item);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Budget bar -- sticky on mobile */}
      <div className="budget-bar-sticky shrink-0 px-4 pt-4 pb-1">
        <BudgetBar currentTotal={summary.totalCost} budget={summary.budget} />
      </div>

      {/* Scrollable cart list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {categoryOrder.map((cat) => {
          const items = grouped.get(cat)!;
          if (items.length === 0) return null;
          const meta = categoryMeta[cat];
          return (
            <div key={cat} className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {meta.label}
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {items.length}
                </span>
                <div className="flex-1 border-b border-[var(--border-light)]" />
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <CartItemRow key={item.itemId} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart summary footer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[var(--text-secondary)]">
              {summary.items.length} items in cart
            </span>
            <div className="flex items-center gap-3">
              {summary.substitutionCount > 0 && (
                <span className="text-xs text-amber-600">
                  {summary.substitutionCount} swap{summary.substitutionCount > 1 ? "s" : ""}
                </span>
              )}
              {summary.savings > 0 && (
                <span className="text-xs text-[var(--budget-green)] font-medium">
                  EUR {centsToEur(summary.savings)} saved
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-[var(--text-muted)]">Total</span>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              EUR {centsToEur(summary.totalCost)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
