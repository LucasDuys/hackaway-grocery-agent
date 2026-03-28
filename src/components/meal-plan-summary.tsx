"use client";

import { getPicnicImageUrl } from "@/lib/picnic/image";

interface MealPlanSummaryProps {
  meals: Array<{
    day: string;
    mealName: string;
    ingredientCount: number;
    estimatedCost: number; // cents
    imageUrl?: string;
  }>;
}

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function MealPlanSummary({ meals }: MealPlanSummaryProps) {
  if (meals.length === 0) return null;

  return (
    <div className="shrink-0 px-3 sm:px-4 pb-3 pt-4">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Meal Plan
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {meals.map((meal) => (
          <div
            key={`${meal.day}-${meal.mealName}`}
            className="min-w-[130px] shrink-0 rounded-xl bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            {meal.imageUrl && (
              <div className="h-16 w-full bg-[var(--surface-muted)] overflow-hidden">
                <img
                  src={getPicnicImageUrl(meal.imageUrl, "medium") || meal.imageUrl}
                  alt={meal.mealName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
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
          </div>
        ))}
      </div>
    </div>
  );
}
