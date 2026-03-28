"use client";

import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useState, useEffect, useRef } from "react";

interface StepBudgetConflictProps {
  isActive: boolean;
}

const substitutions = [
  {
    original: "Starbucks Coffee",
    originalPrice: 39.57,
    replacement: "Picnic blend",
    replacementPrice: 13.99,
    savings: 25.58,
  },
  {
    original: "Premium olive oil",
    originalPrice: 8.99,
    replacement: "Store brand olive oil",
    replacementPrice: 4.49,
    savings: 4.50,
  },
];

const removals = [
  { name: "Fancy crackers", price: 6.49, reason: "occasional item" },
];

export function StepBudgetConflict({ isActive }: StepBudgetConflictProps) {
  const [phase, setPhase] = useState(0);
  // 0: hidden, 1: show total, 2: red flash, 3: show substitutions, 4: count down, 5: green

  const totalValue = useMotionValue(95.40);
  const displayTotal = useTransform(totalValue, (v) => v.toFixed(2));
  const totalRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      totalValue.set(95.40);
      return;
    }
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => {
        setPhase(4);
        animate(totalValue, 59.33, { duration: 1.5, ease: "easeOut" });
      }, 3600),
      setTimeout(() => setPhase(5), 5200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isActive, totalValue]);

  // Subscribe to motion value for display
  const [totalDisplay, setTotalDisplay] = useState("95.40");
  useEffect(() => {
    const unsub = displayTotal.on("change", (v) => setTotalDisplay(v));
    return unsub;
  }, [displayTotal]);

  return (
    <motion.div
      className="relative flex h-full flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Red flash overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundColor: "var(--picnic-red-light)" }}
        initial={{ opacity: 0 }}
        animate={phase === 2 ? { opacity: [0, 0.8, 0] } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Step 5
      </p>
      <h2 className="mb-12 text-center text-5xl font-bold text-[var(--text-primary)]">
        Budget Conflict
      </h2>

      <div className="flex max-w-4xl w-full gap-10">
        {/* Left: total + bar */}
        <div className="flex-1 flex flex-col items-center">
          <motion.div
            className="mb-6 text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Cart Total
            </p>
            <span
              ref={totalRef}
              className={`text-6xl font-bold ${phase >= 5 ? "text-[var(--budget-green)]" : phase >= 2 ? "text-[var(--budget-red)]" : "text-[var(--text-primary)]"}`}
            >
              EUR {totalDisplay}
            </span>
          </motion.div>

          {/* Budget bar */}
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0 }}
            animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Budget</span>
              <span className="text-sm font-bold text-[var(--text-secondary)]">EUR 80.00</span>
            </div>
            <div className="relative h-4 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: "0%", backgroundColor: "var(--budget-green)" }}
                animate={
                  phase >= 5
                    ? { width: "74%", backgroundColor: "var(--budget-green)" }
                    : phase >= 1
                    ? { width: "100%", backgroundColor: "var(--budget-red)" }
                    : { width: "0%" }
                }
                transition={{ duration: 0.8 }}
              />
              {/* Budget line marker */}
              <div
                className="absolute inset-y-0 w-0.5 bg-[var(--text-primary)]"
                style={{ left: "83.5%" }}
              />
            </div>
            <motion.p
              className="mt-2 text-sm font-medium"
              initial={{ opacity: 0 }}
              animate={
                phase >= 5
                  ? { opacity: 1, color: "var(--budget-green)" }
                  : phase >= 2
                  ? { opacity: 1, color: "var(--budget-red)" }
                  : { opacity: 0 }
              }
              transition={{ duration: 0.4 }}
            >
              {phase >= 5 ? "EUR 20.67 under budget" : "Over budget by EUR 15.40"}
            </motion.p>
          </motion.div>

          {/* Label */}
          <motion.p
            className="mt-8 text-sm font-medium text-[var(--text-secondary)] text-center"
            initial={{ opacity: 0 }}
            animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            Max 3 swaps, staples protected, recipes untouched
          </motion.p>
        </div>

        {/* Right: substitutions */}
        <motion.div
          className="flex-1 flex flex-col gap-4"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Substitutions
          </p>

          {substitutions.map((sub, i) => (
            <motion.div
              key={sub.original}
              className="rounded-2xl bg-[var(--surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
              initial={{ opacity: 0, x: 40 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
              transition={{ duration: 0.4, delay: i * 0.2 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-base text-[var(--text-secondary)] line-through">
                  {sub.original}
                </span>
                <span className="text-sm font-bold text-[var(--budget-red)]">
                  EUR {sub.originalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-[var(--text-primary)]">
                  {sub.replacement}
                </span>
                <span className="text-sm font-bold text-[var(--budget-green)]">
                  EUR {sub.replacementPrice.toFixed(2)}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  - EUR {sub.savings.toFixed(2)}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Removals */}
          {removals.map((item, i) => (
            <motion.div
              key={item.name}
              className="rounded-2xl bg-[var(--surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
              initial={{ opacity: 0, x: 40 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.2 }}
            >
              <div className="flex items-center gap-3">
                <span className="text-base text-[var(--text-secondary)] line-through">
                  {item.name}
                </span>
                <span className="text-sm font-bold text-[var(--budget-red)] line-through">
                  EUR {item.price.toFixed(2)}
                </span>
                <span className="inline-flex items-center rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-xs font-medium text-stone-500">
                  removed ({item.reason})
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
