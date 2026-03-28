"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepCheckoutProps {
  isActive: boolean;
}

const apiSteps = [
  { method: "POST", path: "/clear-cart", label: "Clear existing cart" },
  { method: "POST", path: "/add-to-cart (x15)", label: "Add all items" },
  { method: "POST", path: "/set-delivery-slot", label: "Lock delivery window" },
  { method: "GET", path: "/get-cart (verify)", label: "Verify cart contents" },
];

export function StepCheckout({ isActive }: StepCheckoutProps) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setCompletedSteps(0);
      setShowConfirmation(false);
      return;
    }
    const timers = [
      setTimeout(() => setCompletedSteps(1), 600),
      setTimeout(() => setCompletedSteps(2), 1400),
      setTimeout(() => setCompletedSteps(3), 2000),
      setTimeout(() => setCompletedSteps(4), 2600),
      setTimeout(() => setShowConfirmation(true), 3400),
    ];
    return () => timers.forEach(clearTimeout);
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
        Step 7
      </p>
      <h2 className="mb-12 text-center text-5xl font-bold text-[var(--text-primary)]">
        Checkout
      </h2>

      {/* API call sequence */}
      <div className="max-w-lg w-full mb-10 flex flex-col gap-3">
        {apiSteps.map((step, i) => {
          const isDone = i < completedSteps;
          const isRunning = i === completedSteps - 1 || (i === completedSteps && completedSteps > 0);

          return (
            <motion.div
              key={step.path}
              className="flex items-center gap-4 rounded-xl px-5 py-4"
              style={{ backgroundColor: "#1E293B" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.15 }}
            >
              <code className="shrink-0 text-sm font-mono font-bold text-amber-400">
                {step.method}
              </code>
              <code className="flex-1 text-sm font-mono text-[#E2E8F0]">{step.path}</code>
              <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                {i < completedSteps ? (
                  <motion.svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <circle cx="10" cy="10" r="10" fill="var(--budget-green)" />
                    <polyline
                      points="5 10, 9 14, 15 6"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.svg>
                ) : i === completedSteps && completedSteps < apiSteps.length ? (
                  <div className="h-4 w-4 rounded-full border-2 border-[#E2E8F0] border-t-transparent animate-spin" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-[#475569]" />
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Progress bar for add-to-cart */}
        {completedSteps >= 1 && completedSteps <= 2 && (
          <motion.div
            className="mx-5 h-1.5 rounded-full bg-[#334155] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full rounded-full bg-[var(--budget-green)]"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.8 }}
            />
          </motion.div>
        )}
      </div>

      {/* Confirmation card */}
      <motion.div
        className="max-w-lg w-full rounded-2xl bg-[var(--surface)] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={showConfirmation ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.6 }}
      >
        {/* Delivery truck animation */}
        <div className="mb-4 overflow-hidden h-10 relative">
          <motion.div
            className="absolute top-0"
            initial={{ left: "-40px" }}
            animate={showConfirmation ? { left: "calc(100% + 40px)" } : { left: "-40px" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          >
            <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
              <rect x="0" y="4" width="24" height="16" rx="3" fill="var(--picnic-red)" />
              <rect x="24" y="8" width="12" height="12" rx="2" fill="var(--picnic-orange)" />
              <circle cx="10" cy="24" r="4" fill="var(--text-primary)" />
              <circle cx="10" cy="24" r="2" fill="var(--surface)" />
              <circle cx="32" cy="24" r="4" fill="var(--text-primary)" />
              <circle cx="32" cy="24" r="2" fill="var(--surface)" />
            </svg>
          </motion.div>
        </div>

        <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Your groceries arrive Monday 18:00 - 21:00
        </h3>
        <p className="text-base text-[var(--text-secondary)] mb-6">
          15 items | EUR 59.33 | 3 meals planned
        </p>

        <motion.p
          className="text-xl font-bold text-[var(--picnic-red)]"
          initial={{ opacity: 0 }}
          animate={showConfirmation ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          One sentence. Five agents. Your week, sorted.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
