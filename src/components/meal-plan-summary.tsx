"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getPicnicImageUrl } from "@/lib/picnic/image";

interface MealIngredient {
  name: string;
  quantity: number;
  price: number;
}

interface MealPlanSummaryProps {
  meals: Array<{
    day: string;
    mealName: string;
    ingredientCount: number;
    estimatedCost: number; // cents
    imageUrl?: string;
    ingredients?: MealIngredient[];
  }>;
}

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

const PLACEHOLDER_COLORS = [
  "bg-rose-100 text-rose-600",
  "bg-amber-100 text-amber-600",
  "bg-emerald-100 text-emerald-600",
  "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600",
  "bg-orange-100 text-orange-600",
  "bg-teal-100 text-teal-600",
];

function getPlaceholderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

export function MealPlanSummary({ meals }: MealPlanSummaryProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (meals.length === 0) return null;

  return (
    <div className="shrink-0 px-3 sm:px-4 pb-3 pt-4">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Meal Plan
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {meals.map((meal) => {
          const key = `${meal.day}-${meal.mealName}`;
          const isExpanded = expandedKey === key;

          return (
            <div
              key={key}
              className="min-w-[130px] shrink-0 rounded-xl bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden cursor-pointer select-none transition-all"
              style={{ maxWidth: isExpanded ? "280px" : "180px" }}
              onClick={() => setExpandedKey(isExpanded ? null : key)}
            >
              {/* Image / Placeholder */}
              {meal.imageUrl ? (
                <div
                  className={`w-full bg-[var(--surface-muted)] overflow-hidden transition-all ${isExpanded ? "h-36" : "h-24"}`}
                >
                  <img
                    src={getPicnicImageUrl(meal.imageUrl, "medium") || meal.imageUrl}
                    alt={meal.mealName}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div
                  className={`w-full flex items-center justify-center transition-all ${isExpanded ? "h-36" : "h-24"} ${getPlaceholderColor(meal.mealName)}`}
                >
                  <span className={`font-bold ${isExpanded ? "text-4xl" : "text-2xl"}`}>
                    {meal.mealName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--picnic-red)]">
                  {meal.day}
                </span>
                <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)] truncate">
                  {meal.mealName}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {meal.ingredientCount} items
                  </span>
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                    EUR {centsToEur(meal.estimatedCost)}
                  </span>
                </div>
              </div>

              {/* Expanded ingredient list */}
              <AnimatePresence>
                {isExpanded && meal.ingredients && meal.ingredients.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[var(--border-light)] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                        Ingredients
                      </p>
                      <ul className="space-y-1">
                        {meal.ingredients.map((ing, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between text-[11px]"
                          >
                            <span className="text-[var(--text-secondary)] truncate mr-2">
                              {ing.name}
                            </span>
                            <span className="text-[var(--text-muted)] shrink-0">
                              x{ing.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 pt-1.5 border-t border-[var(--border-light)] flex justify-between text-[11px]">
                        <span className="font-medium text-[var(--text-secondary)]">Total</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          EUR {centsToEur(meal.estimatedCost)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
