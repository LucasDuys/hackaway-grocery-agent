"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepCartAssemblyProps {
  isActive: boolean;
}

type ChipType = "repeat" | "recipe" | "swap" | "co-buy";

const chipStyles: Record<ChipType, { borderClass: string; textClass: string; bgClass: string }> = {
  repeat: { borderClass: "border-stone-200", textClass: "text-stone-500", bgClass: "bg-stone-50/60" },
  recipe: { borderClass: "border-sky-200", textClass: "text-sky-600", bgClass: "bg-sky-50/60" },
  swap: { borderClass: "border-amber-200", textClass: "text-amber-600", bgClass: "bg-amber-50/60" },
  "co-buy": { borderClass: "border-emerald-200", textClass: "text-emerald-500", bgClass: "bg-emerald-50/60" },
};

const cartItems: { name: string; price: number; chip: ChipType; initial: string }[] = [
  { name: "Whole milk 1L", price: 1.29, chip: "repeat", initial: "M" },
  { name: "Brood volkoren", price: 2.19, chip: "repeat", initial: "B" },
  { name: "Eieren 10-pack", price: 2.49, chip: "repeat", initial: "E" },
  { name: "Lasagna sheets", price: 1.89, chip: "recipe", initial: "L" },
  { name: "Gehakt 500g", price: 3.99, chip: "recipe", initial: "G" },
  { name: "Tomato sauce", price: 1.49, chip: "recipe", initial: "T" },
  { name: "Mozzarella", price: 1.79, chip: "recipe", initial: "M" },
  { name: "Kaas geraspd", price: 2.39, chip: "repeat", initial: "K" },
  { name: "Picnic blend coffee", price: 13.99, chip: "swap", initial: "P" },
  { name: "Store brand olive oil", price: 4.49, chip: "swap", initial: "O" },
  { name: "Uien 1kg", price: 1.29, chip: "co-buy", initial: "U" },
  { name: "Paprika rood", price: 0.99, chip: "recipe", initial: "P" },
  { name: "Sla ijsberg", price: 1.19, chip: "repeat", initial: "S" },
  { name: "Boter ongezouten", price: 2.29, chip: "co-buy", initial: "B" },
  { name: "Chips naturel", price: 1.59, chip: "repeat", initial: "C" },
];

const TOTAL = cartItems.reduce((s, i) => s + i.price, 0);

export function StepCartAssembly({ isActive }: StepCartAssemblyProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 300 + cartItems.length * 80 + 400);
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Step 6
      </p>
      <h2 className="mb-10 text-center text-5xl font-bold text-[var(--text-primary)]">
        Cart Assembly
      </h2>

      {/* Cart grid */}
      <div className="grid max-w-4xl w-full grid-cols-3 gap-3 mb-8">
        {cartItems.map((item, i) => (
          <motion.div
            key={`${item.name}-${i}`}
            className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
            initial={{ opacity: 0, y: 16 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: "var(--picnic-red)" }}
            >
              {item.initial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {item.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-secondary)]">
                  EUR {item.price.toFixed(2)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight ${chipStyles[item.chip].borderClass} ${chipStyles[item.chip].textClass} ${chipStyles[item.chip].bgClass}`}
                >
                  {item.chip}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Budget bar + total */}
      <motion.div
        className="max-w-lg w-full rounded-2xl bg-[var(--surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Budget
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-[var(--budget-green)]">
              EUR {TOTAL.toFixed(2)}
            </span>
            <span className="text-xs text-[var(--text-muted)]">/ EUR 80.00</span>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--budget-green)]"
            initial={{ width: "0%" }}
            animate={phase >= 2 ? { width: `${Math.min((TOTAL / 80) * 100, 100)}%` } : { width: "0%" }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <p className="mt-3 text-center text-lg font-semibold text-[var(--text-primary)]">
          {cartItems.length} items, EUR {TOTAL.toFixed(2)}
        </p>
      </motion.div>
    </motion.div>
  );
}
