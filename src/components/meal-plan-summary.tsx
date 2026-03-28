"use client";

interface MealPlanSummaryProps {
  meals: Array<{
    day: string;
    mealName: string;
    ingredientCount: number;
    estimatedCost: number; // cents
  }>;
}

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function MealPlanSummary({ meals }: MealPlanSummaryProps) {
  if (meals.length === 0) return null;

  return (
    <div className="shrink-0 px-4 pb-3 pt-4">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Meal Plan
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {meals.map((meal) => (
          <div
            key={`${meal.day}-${meal.mealName}`}
            className="min-w-[140px] flex-shrink-0 rounded-xl bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
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
        ))}
      </div>
    </div>
  );
}
