"use client";

import type { CartSummary, CartItem } from "@/types";
import { CartItemRow } from "./cart-item";
import { BudgetBar } from "./budget-bar";

interface CartViewProps {
  summary: CartSummary;
  isRunning?: boolean;
  onRemoveItem?: (itemId: string) => void;
}

type Category = "produce" | "dairy" | "proteins" | "bakery" | "drinks" | "pantry" | "frozen" | "snacks" | "other";

const categoryMeta: Record<Category, { label: string }> = {
  produce: { label: "Groente & Fruit" },
  dairy: { label: "Zuivel & Eieren" },
  proteins: { label: "Vlees & Vis" },
  bakery: { label: "Bakkerij" },
  drinks: { label: "Dranken" },
  pantry: { label: "Houdbaar" },
  frozen: { label: "Diepvries" },
  snacks: { label: "Snacks & Snoep" },
  other: { label: "Overig" },
};

const categoryOrder: Category[] = ["produce", "dairy", "proteins", "bakery", "drinks", "pantry", "frozen", "snacks", "other"];

const categoryKeywords: Record<Exclude<Category, "other">, string[]> = {
  produce: [
    "groente", "fruit", "sla", "tomaat", "komkommer", "paprika", "ui", "aardappel", "wortel",
    "appel", "banaan", "citroen", "avocado", "spinazie", "broccoli", "champignon", "prei",
    "courgette", "bloemkool",
    // English fallbacks
    "banana", "tomato", "onion", "lettuce", "carrot", "apple", "lemon", "spinach",
  ],
  dairy: [
    "melk", "kaas", "yoghurt", "boter", "room", "ei", "eieren", "kwark", "zuivel", "vla",
    // English fallbacks
    "milk", "cheese", "yogurt", "butter", "cream", "egg",
  ],
  proteins: [
    "kip", "kipfilet", "gehakt", "vlees", "vis", "zalm", "tonijn", "garnaal", "worst",
    "hamburger", "schnitzel", "spek", "bacon",
    // English fallbacks
    "chicken", "beef", "salmon", "pork", "tofu", "fish",
  ],
  bakery: [
    "brood", "croissant", "stokbrood", "bolletje", "cake", "muffin", "beschuit", "crackers",
    "moulin", "boerenbrood", "vloerbrood",
  ],
  drinks: [
    "water", "sap", "cola", "bier", "wijn", "koffie", "thee", "frisdrank", "limonade",
    "espresso", "cappuccino", "juice",
  ],
  pantry: [
    "pasta", "rijst", "olie", "azijn", "saus", "tomaten", "bonen", "noten", "meel", "suiker",
    "zout", "peper", "kruiden", "bouillon", "soep",
    // English fallbacks
    "rice", "olive oil", "flour", "sauce", "soy", "garlic", "cereal", "oat",
  ],
  frozen: [
    "diepvries", "ijs", "bevroren",
  ],
  snacks: [
    "chips", "chocolade", "koek", "snoep", "popcorn", "drop", "cookie", "biscuit",
  ],
};

function categorizeItem(item: CartItem): Category {
  const name = item.name.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => name.includes(kw))) {
      return category as Category;
    }
  }
  return "other";
}

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CartView({ summary, isRunning = false, onRemoveItem }: CartViewProps) {
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
      <div className="budget-bar-sticky shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-1">
        <BudgetBar currentTotal={summary.totalCost} budget={summary.budget} isComplete={!isRunning} />
      </div>

      {/* Scrollable cart list */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4">
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
                {items.map((item, idx) => (
                  <CartItemRow key={`${item.itemId}-${idx}`} item={item} onRemove={onRemoveItem} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart summary footer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 sm:px-5 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[var(--text-secondary)]">
              {summary.items.length} item{summary.items.length !== 1 ? "s" : ""}
              {summary.substitutionCount > 0 && (
                <span className="text-[var(--text-muted)]">
                  {" "} / {summary.substitutionCount} swap{summary.substitutionCount > 1 ? "s" : ""}
                </span>
              )}
            </span>
            {summary.savings > 0 && (
              <span className="text-xs font-medium" style={{ color: "#16A34A" }}>
                EUR {centsToEur(summary.savings)} saved
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-[var(--text-primary)]">
              EUR {centsToEur(summary.totalCost)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
