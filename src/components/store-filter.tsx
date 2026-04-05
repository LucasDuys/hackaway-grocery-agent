"use client";

import { motion } from "motion/react";
import type { StoreSlug } from "@/lib/scrapers/types";
import { StoreLogo } from "./store-logo";

const ALL_STORES: StoreSlug[] = ["ah", "jumbo", "lidl", "picnic", "plus", "aldi"];

interface StoreFilterProps {
  selectedStores: string[];
  onChange: (stores: string[]) => void;
  mode?: "filter" | "select";
}

export function StoreFilter({
  selectedStores,
  onChange,
  mode = "filter",
}: StoreFilterProps) {
  const allSelected = ALL_STORES.every((s) => selectedStores.includes(s));

  function toggleStore(slug: string) {
    if (selectedStores.includes(slug)) {
      onChange(selectedStores.filter((s) => s !== slug));
    } else {
      onChange([...selectedStores, slug]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...ALL_STORES]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.button
        type="button"
        onClick={toggleAll}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
          allSelected
            ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
        }`}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
      >
        All
      </motion.button>

      {ALL_STORES.map((slug) => {
        const isSelected = selectedStores.includes(slug);

        return (
          <motion.button
            key={slug}
            type="button"
            onClick={() => toggleStore(slug)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${
              isSelected
                ? "border-[var(--accent)] bg-[var(--accent-light)]"
                : "border-[var(--border)] bg-[var(--surface)] opacity-40"
            }`}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <StoreLogo slug={slug} size="sm" />
          </motion.button>
        );
      })}
    </div>
  );
}
