"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepSummaryProps {
  isActive: boolean;
}

const demonstrated = [
  {
    title: "Persistent Identity (SOUL.md)",
    detail: "Every agent reads from a shared soul document that defines personality, constraints, and household context.",
  },
  {
    title: "Accumulated Memory (preference learning)",
    detail: "100 orders analyzed, 82 unique products tracked. Order history builds a preference model -- staples, co-purchases, spending patterns -- that improves over time.",
  },
  {
    title: "Periodic Autonomy (proactive reorder notification)",
    detail: "The agent detects when staple items are likely running low and proactively suggests a reorder.",
  },
  {
    title: "Social Context (agent data handoffs)",
    detail: "Five specialized agents pass structured data through a DAG -- meal plans, budgets, substitutions -- without losing context.",
  },
  {
    title: "Free-form meal planning",
    detail: "Handles named dishes, nutritional goals, and category requests. Natural language input parsed into structured meal plans.",
  },
  {
    title: "Scale",
    detail: "100 orders analyzed, 499 products indexed, <50ms analysis. Customer profile built from 2 years of purchase history.",
  },
];

const cutItems = [
  {
    feature: "Voice input",
    reason: "Zero depth -- a thin wrapper around speech-to-text adds no architectural insight.",
  },
  {
    feature: "Multi-store routing",
    reason: "Logistics, not intelligence. Interesting for ops, but does not demonstrate agent coordination.",
  },
  {
    feature: "Real-time price tracking",
    reason: "Useful for budget optimization, but adds API complexity without demonstrating agent coordination.",
  },
];

export function StepSummary({ isActive }: StepSummaryProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isActive]);

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-8 py-12 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="mb-10 text-center text-5xl font-bold text-[var(--text-primary)]"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        What we demonstrated
      </motion.h2>

      {/* OpenClaw primitives */}
      <div className="grid max-w-5xl grid-cols-2 gap-5 mb-14 w-full">
        {demonstrated.map((item, i) => (
          <motion.div
            key={item.title}
            className="rounded-2xl bg-[var(--surface)] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--picnic-red)]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <polyline
                    points="3 8, 7 12, 13 4"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">{item.title}</h3>
                <p className="text-base text-[var(--text-secondary)] leading-relaxed">{item.detail}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* What we cut */}
      <motion.div
        className="max-w-5xl w-full"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h3 className="mb-5 text-center text-3xl font-bold text-[var(--text-primary)]">
          What we cut and why
        </h3>
        <div className="flex gap-5">
          {cutItems.map((item, i) => (
            <motion.div
              key={item.feature}
              className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
              initial={{ opacity: 0, y: 15 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <p className="text-lg font-bold text-[var(--text-primary)] mb-1">{item.feature}</p>
              <p className="text-base text-[var(--text-secondary)] leading-relaxed">{item.reason}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Restart hint */}
      <motion.p
        className="mt-10 text-base text-[var(--text-muted)]"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: [0, 1, 0.4, 1] } : { opacity: 0 }}
        transition={{ duration: 2, delay: 0.5, repeat: Infinity, repeatDelay: 2 }}
      >
        Press R to restart
      </motion.p>
    </motion.div>
  );
}
