"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "@/components/header";
import { StoreLogo } from "@/components/store-logo";
import type { StoreSlug } from "@/lib/scrapers/types";

/* ---------- Types ---------- */

interface MealIngredient {
  name: string;
  amount: string;
  estimatedCostCents: number;
  store?: StoreSlug;
}

interface Meal {
  name: string;
  prepTimeMinutes: number;
  estimatedCostCents: number;
  ingredients: MealIngredient[];
}

interface DayPlan {
  day: string;
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
}

interface ShoppingItem {
  name: string;
  totalAmount: string;
  estimatedCostCents: number;
  store?: StoreSlug;
}

interface StoreBreakdown {
  store: StoreSlug;
  totalCents: number;
  itemCount: number;
}

interface MealPlanResult {
  days: DayPlan[];
  shoppingList: ShoppingItem[];
  storeBreakdown: StoreBreakdown[];
  totalCostCents: number;
}

/* ---------- Constants ---------- */

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "lactose-free",
  "halal",
  "low-sugar",
  "nut-free",
] as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------- Helpers ---------- */

function formatEur(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `EUR ${euros}`;
}

/* ---------- Component ---------- */

export default function MealsPage() {
  // Form state
  const [budgetEur, setBudgetEur] = useState("50");
  const [days, setDays] = useState(5);
  const [householdSize, setHouseholdSize] = useState(2);
  const [dietary, setDietary] = useState<string[]>([]);
  const [preferences, setPreferences] = useState("");

  // Result state
  const [result, setResult] = useState<MealPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [addingToList, setAddingToList] = useState(false);
  const [listCreated, setListCreated] = useState(false);

  function toggleDietary(option: string) {
    setDietary((prev) =>
      prev.includes(option)
        ? prev.filter((d) => d !== option)
        : [...prev, option],
    );
  }

  function toggleMealExpand(key: string) {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setListCreated(false);
    setExpandedMeals(new Set());
    setIsLoading(true);

    try {
      const budgetCents = Math.round(parseFloat(budgetEur) * 100);
      if (isNaN(budgetCents) || budgetCents <= 0) {
        setError("Please enter a valid budget.");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetCents,
          days,
          householdSize,
          dietaryRestrictions: dietary,
          preferences: preferences.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Request failed with status ${res.status}`,
        );
      }

      const raw = await res.json();

      // Transform API response to page format
      const mp = raw.mealPlan || raw;
      const apiDays = mp.days || [];

      const parsedDays: DayPlan[] = apiDays.map((d: { dayNumber?: number; meals?: Array<{ name: string; type?: string; servings?: number; ingredients?: Array<{ name: string; quantity?: string; estimatedPriceCents?: number }>; estimatedTotalCents?: number; preparationTimeMinutes?: number }> }, idx: number) => {
        const meals = d.meals || [];
        const findMeal = (type: string): Meal => {
          const m = meals.find((m) => m.type === type) || meals[0];
          if (!m) return { name: "No meal planned", prepTimeMinutes: 0, estimatedCostCents: 0, ingredients: [] };
          return {
            name: m.name,
            prepTimeMinutes: m.preparationTimeMinutes || 0,
            estimatedCostCents: m.estimatedTotalCents || 0,
            ingredients: (m.ingredients || []).map((ing) => ({
              name: ing.name,
              amount: ing.quantity || "",
              estimatedCostCents: ing.estimatedPriceCents || 0,
            })),
          };
        };
        return {
          day: DAY_LABELS[idx % 7] || `Day ${idx + 1}`,
          breakfast: findMeal("breakfast"),
          lunch: findMeal("lunch"),
          dinner: findMeal("dinner"),
        };
      });

      const shoppingList: ShoppingItem[] = (mp.shoppingList || raw.shoppingList || []).map((item: { ingredientName?: string; name?: string; totalQuantity?: string; totalAmount?: string; estimatedPriceCents?: number; estimatedCostCents?: number }) => ({
        name: item.ingredientName || item.name || "",
        totalAmount: item.totalQuantity || item.totalAmount || "",
        estimatedCostCents: item.estimatedPriceCents || item.estimatedCostCents || 0,
      }));

      const data: MealPlanResult = {
        days: parsedDays,
        shoppingList,
        storeBreakdown: [],
        totalCostCents: mp.totalCostCents || raw.totalCostCents || 0,
      };
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddAllToList() {
    if (!result) return;
    setAddingToList(true);

    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Meal Plan - ${new Date().toLocaleDateString("nl-NL")}`,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create shopping list");
      }

      setListCreated(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create shopping list",
      );
    } finally {
      setAddingToList(false);
    }
  }

  const budgetCents = Math.round(parseFloat(budgetEur || "0") * 100);
  const budgetProgress = result
    ? Math.min((result.totalCostCents / budgetCents) * 100, 100)
    : 0;
  const isOverBudget = result ? result.totalCostCents > budgetCents : false;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              Meal Planner
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Generate a meal plan optimized for the cheapest Dutch supermarket
              prices.
            </p>
          </div>

          {/* ---------- Input Form ---------- */}
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
          >
            <div className="grid gap-5 sm:grid-cols-3">
              {/* Budget */}
              <div>
                <label
                  htmlFor="budget"
                  className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
                >
                  Budget (EUR)
                </label>
                <input
                  id="budget"
                  type="number"
                  min="5"
                  max="500"
                  step="1"
                  value={budgetEur}
                  onChange={(e) => setBudgetEur(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                  placeholder="50"
                />
              </div>

              {/* Days */}
              <div>
                <label
                  htmlFor="days"
                  className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
                >
                  Number of days
                </label>
                <select
                  id="days"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "day" : "days"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Household size */}
              <div>
                <label
                  htmlFor="household"
                  className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
                >
                  Household size
                </label>
                <select
                  id="household"
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dietary restrictions */}
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">
                Dietary restrictions
              </p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((option) => {
                  const isSelected = dietary.includes(option);
                  return (
                    <motion.button
                      key={option}
                      type="button"
                      onClick={() => toggleDietary(option)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                      }`}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                    >
                      {option}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Preferences */}
            <div className="mt-5">
              <label
                htmlFor="preferences"
                className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
              >
                Preferences{" "}
                <span className="font-normal text-[var(--text-muted)]">
                  (optional)
                </span>
              </label>
              <input
                id="preferences"
                type="text"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                placeholder="e.g., Italian food, quick meals"
              />
            </div>

            {/* Submit */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating your meal plan...
                  </span>
                ) : (
                  "Plan My Meals"
                )}
              </button>
            </div>
          </form>

          {/* ---------- Error ---------- */}
          {error && (
            <div className="mt-6 rounded-lg border border-[var(--danger)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* ---------- Loading animation ---------- */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-8 flex flex-col items-center gap-3 py-12"
              >
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]"
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  Generating your meal plan...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ---------- Results ---------- */}
          {result && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-8 space-y-8"
            >
              {/* Budget progress bar */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--text-primary)]">
                    Total estimated cost
                  </span>
                  <span
                    className={`font-bold ${
                      isOverBudget
                        ? "text-[var(--danger)]"
                        : "text-[var(--success)]"
                    }`}
                  >
                    {formatEur(result.totalCostCents)} / {formatEur(budgetCents)}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <motion.div
                    className={`h-full rounded-full ${
                      isOverBudget ? "bg-[var(--danger)]" : "bg-[var(--success)]"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetProgress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                {isOverBudget && (
                  <p className="mt-1.5 text-xs text-[var(--danger)]">
                    Over budget by{" "}
                    {formatEur(result.totalCostCents - budgetCents)}
                  </p>
                )}
              </div>

              {/* Day cards */}
              <div>
                <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
                  Your Meal Plan
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.days.map((dayPlan, dayIdx) => (
                    <div
                      key={dayPlan.day}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                      <h3 className="mb-3 text-sm font-bold text-[var(--accent)]">
                        {DAY_LABELS[dayIdx] || dayPlan.day} &mdash; {dayPlan.day}
                      </h3>

                      {(
                        [
                          ["Breakfast", dayPlan.breakfast],
                          ["Lunch", dayPlan.lunch],
                          ["Dinner", dayPlan.dinner],
                        ] as const
                      ).map(([label, meal]) => {
                        const mealKey = `${dayIdx}-${label}`;
                        const isExpanded = expandedMeals.has(mealKey);

                        return (
                          <div
                            key={label}
                            className="border-t border-[var(--border-light)] py-2.5 first:border-t-0 first:pt-0"
                          >
                            <button
                              type="button"
                              onClick={() => toggleMealExpand(mealKey)}
                              className="flex w-full items-start justify-between gap-2 text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                  {label}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)] leading-snug">
                                  {meal.name}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                  <span>{meal.prepTimeMinutes} min</span>
                                  <span>{formatEur(meal.estimatedCostCents)}</span>
                                </div>
                              </div>
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`mt-1 shrink-0 text-[var(--text-muted)] transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <ul className="mt-2 space-y-1 pl-1">
                                    {meal.ingredients.map((ing, i) => (
                                      <li
                                        key={i}
                                        className="flex items-center justify-between text-xs text-[var(--text-secondary)]"
                                      >
                                        <span>
                                          {ing.amount} {ing.name}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          {ing.store && (
                                            <StoreLogo
                                              slug={ing.store}
                                              size="sm"
                                            />
                                          )}
                                          <span className="text-[var(--text-muted)]">
                                            {formatEur(ing.estimatedCostCents)}
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Shopping list */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Shopping List
                  </h2>
                  <button
                    type="button"
                    onClick={handleAddAllToList}
                    disabled={addingToList || listCreated}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      listCreated
                        ? "bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]"
                        : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
                    }`}
                  >
                    {addingToList ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Adding...
                      </span>
                    ) : listCreated ? (
                      "Added to Lists"
                    ) : (
                      "Add All to Shopping List"
                    )}
                  </button>
                </div>

                <div className="mt-4 divide-y divide-[var(--border-light)]">
                  {result.shoppingList.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.store && (
                          <StoreLogo slug={item.store} size="sm" />
                        )}
                        <span className="text-sm text-[var(--text-primary)]">
                          {item.name}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {item.totalAmount}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-[var(--text-secondary)]">
                        {formatEur(item.estimatedCostCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Store breakdown */}
              {result.storeBreakdown.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
                    Store Breakdown
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {result.storeBreakdown.map((sb) => (
                      <div
                        key={sb.store}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <StoreLogo slug={sb.store} size="md" />
                          <span className="text-xs text-[var(--text-muted)]">
                            {sb.itemCount} {sb.itemCount === 1 ? "item" : "items"}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {formatEur(sb.totalCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
