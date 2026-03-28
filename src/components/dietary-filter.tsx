"use client";

import type { DietaryRestriction } from "@/types";

interface DietaryFilterProps {
  selected: DietaryRestriction[];
  onChange: (selected: DietaryRestriction[]) => void;
}

const RESTRICTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "lactose-free", label: "Lactose-free" },
  { value: "low-sugar", label: "Low sugar" },
  { value: "halal", label: "Halal" },
  { value: "nut-free", label: "Nut-free" },
];

export function DietaryFilter({ selected, onChange }: DietaryFilterProps) {
  function toggle(value: DietaryRestriction) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="px-4 py-3 border-b border-[var(--border-light)]">
      <p className="text-xs text-[var(--text-muted)] mb-2">Dietary preferences</p>
      <div className="flex flex-wrap gap-2">
        {RESTRICTIONS.map(({ value, label }) => {
          const isSelected = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
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
  );
}
