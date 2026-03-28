"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { DietaryRestriction } from "@/types";

const RESTRICTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "lactose-free", label: "Lactose-free" },
  { value: "low-sugar", label: "Low sugar" },
  { value: "halal", label: "Halal" },
  { value: "nut-free", label: "Nut-free" },
];

interface InputBarProps {
  onSubmit: (input: string) => void;
  isRunning: boolean;
  onReset?: () => void;
  showReset?: boolean;
  dietaryRestrictions?: DietaryRestriction[];
  onDietaryChange?: (selected: DietaryRestriction[]) => void;
}

export function InputBar({
  onSubmit,
  isRunning,
  onReset,
  showReset,
  dietaryRestrictions = [],
  onDietaryChange,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isRunning) return;
    onSubmit(trimmed);
  }

  function toggleDietary(restriction: DietaryRestriction) {
    if (!onDietaryChange) return;
    if (dietaryRestrictions.includes(restriction)) {
      onDietaryChange(dietaryRestrictions.filter((v) => v !== restriction));
    } else {
      onDietaryChange([...dietaryRestrictions, restriction]);
    }
  }

  const activeCount = dietaryRestrictions.length;

  return (
    <div className="shrink-0 border-t border-[var(--border-light)] bg-[var(--surface)]">
      {/* Collapsible dietary filter panel */}
      <AnimatePresence>
        {showFilters && onDietaryChange && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--border-light)]">
              <p className="text-xs text-[var(--text-muted)] mb-2">Dietary preferences</p>
              <div className="flex flex-wrap gap-2">
                {RESTRICTIONS.map(({ value: val, label }) => {
                  const isSelected = dietaryRestrictions.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => toggleDietary(val)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-[var(--picnic-red-light)] text-[var(--picnic-red)] border border-[var(--picnic-red)]"
                          : "bg-transparent text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="input-bar-mobile flex items-center gap-2 px-4 py-3"
      >
        {/* Gear / settings button */}
        {onDietaryChange && (
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
              showFilters
                ? "border-[var(--picnic-red)] bg-[var(--picnic-red-light)] text-[var(--picnic-red)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-[var(--text-secondary)]"
            }`}
            title="Dietary preferences"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {/* Active filter count badge */}
            {activeCount > 0 && !showFilters && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--picnic-red)] px-1 text-[9px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        )}

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What do you need this week?"
          disabled={isRunning}
          className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--picnic-red)] focus:outline-none focus:ring-2 focus:ring-[var(--picnic-red-light)] disabled:opacity-50 transition-all"
        />

        {/* Active dietary indicator (inline, when collapsed) */}
        {activeCount > 0 && !showFilters && (
          <span className="hidden sm:block shrink-0 text-[11px] text-[var(--text-muted)]">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </span>
        )}

        <button
          type="submit"
          disabled={isRunning || !value.trim()}
          className="rounded-full bg-[var(--picnic-red)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--picnic-red-hover)] disabled:opacity-40"
        >
          {isRunning ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Working
            </span>
          ) : (
            "Go"
          )}
        </button>
        {showReset && !isRunning && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
