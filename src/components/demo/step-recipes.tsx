"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepRecipesProps {
  isActive: boolean;
}

interface Recipe {
  name: string;
  portions: number;
  tags: string[];
  selected: boolean;
}

const recipes: Recipe[] = [
  { name: "Lasagne bolognese", portions: 4, tags: [], selected: true },
  { name: "Nasi goreng met pindasaus", portions: 4, tags: [], selected: false },
  { name: "Krokante gnocchi met tomaten-pesto", portions: 4, tags: ["Vegetarisch"], selected: false },
  { name: "Kip tandoori met boontjes", portions: 4, tags: [], selected: false },
  { name: "Open lasagne met pompoen en ricotta", portions: 4, tags: ["Vegetarisch"], selected: false },
  { name: "Groene lasagne", portions: 4, tags: ["Vegetarisch"], selected: false },
];

export function StepRecipes({ isActive }: StepRecipesProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isActive]);

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Step 5
      </p>
      <h2 className="mb-4 text-center text-5xl font-bold text-[var(--text-primary)]">
        Available Picnic Recipes
      </h2>
      <p className="mb-12 text-center text-xl text-[var(--text-secondary)]">
        Real recipes with verified ingredients and product IDs
      </p>

      <div className="grid max-w-4xl grid-cols-2 gap-6 lg:grid-cols-3">
        {recipes.map((recipe, i) => (
          <motion.div
            key={recipe.name}
            className={`rounded-2xl bg-[var(--surface)] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] ${
              recipe.selected
                ? "ring-2 ring-[var(--picnic-red)]"
                : ""
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <h3 className="mb-2 text-xl font-bold text-[var(--text-primary)]">
              {recipe.name}
            </h3>
            <p className="mb-3 text-base text-[var(--text-secondary)]">
              {recipe.portions} portions
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                >
                  {tag}
                </span>
              ))}

              <span className="rounded-full bg-[var(--picnic-red-light)] px-3 py-1 text-xs font-semibold text-[var(--picnic-red)]">
                Available on Picnic
              </span>
            </div>

            {recipe.selected && (
              <motion.div
                className="mt-4 flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="var(--picnic-red)" />
                  <path
                    d="M5 8L7 10L11 6"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm font-semibold text-[var(--picnic-red)]">
                  Matches your request
                </span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
