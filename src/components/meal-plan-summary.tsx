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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Meal Plan
      </p>
      <div className="flex flex-col gap-2">
        {meals.map((meal) => (
          <div
            key={`${meal.day}-${meal.mealName}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {meal.day}
              </span>
              <span className="text-xs font-medium text-[var(--text-muted)]">
                EUR {centsToEur(meal.estimatedCost)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {meal.mealName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {meal.ingredientCount} ingredient{meal.ingredientCount !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
