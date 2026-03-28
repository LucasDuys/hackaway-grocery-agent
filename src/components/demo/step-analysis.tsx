"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepAnalysisProps {
  isActive: boolean;
}

const insights = [
  {
    title: "82 unique products tracked",
    detail: "Items categorized by purchase frequency across 100 orders",
    barSegments: [
      { width: 45, color: "var(--budget-green)", label: "staple" },
      { width: 30, color: "var(--agent-order-analyst)", label: "regular" },
      { width: 15, color: "var(--agent-budget)", label: "occasional" },
      { width: 10, color: "var(--text-muted)", label: "one-time" },
    ],
  },
  {
    title: "Average weekly spend: EUR 201",
    detail: "100 orders analyzed in <50ms",
    sparkline: [65, 72, 80, 75, 68, 78, 85, 70, 76, 80],
  },
  {
    title: "Dietary filtering",
    detail: "Supports vegetarian, vegan, gluten-free, and 4 more restrictions",
  },
  {
    title: "Top co-purchase: melk + brood",
    detail: "92% co-occurrence in orders",
    pairs: [
      { items: "melk + brood", pct: 92 },
      { items: "eieren + boter", pct: 88 },
      { items: "pasta + saus", pct: 85 },
    ],
  },
];

export function StepAnalysis({ isActive }: StepAnalysisProps) {
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
        Step 4
      </p>
      <h2 className="mb-4 text-center text-5xl font-bold text-[var(--text-primary)]">
        Pattern Analysis
      </h2>
      <p className="mb-12 text-center text-xl text-[var(--text-secondary)]">
        Pure TypeScript, no LLM
      </p>

      <div className="grid max-w-4xl grid-cols-2 gap-6">
        {insights.map((insight, i) => (
          <motion.div
            key={insight.title}
            className="rounded-2xl bg-[var(--surface)] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <h3 className="mb-1 text-xl font-bold text-[var(--text-primary)]">{insight.title}</h3>
            <p className="mb-4 text-base text-[var(--text-secondary)]">{insight.detail}</p>

            {/* Bar segments */}
            {insight.barSegments && (
              <div className="flex gap-1 rounded-lg overflow-hidden h-4">
                {insight.barSegments.map((seg, j) => (
                  <motion.div
                    key={seg.label}
                    className="h-full rounded-sm"
                    style={{ backgroundColor: seg.color }}
                    initial={{ width: 0 }}
                    animate={phase >= 1 ? { width: `${seg.width}%` } : { width: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 + j * 0.1 }}
                  />
                ))}
              </div>
            )}

            {/* Sparkline */}
            {insight.sparkline && (
              <svg width="100%" height="48" viewBox="0 0 200 48" preserveAspectRatio="none">
                <motion.polyline
                  fill="none"
                  stroke="var(--agent-order-analyst)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={(() => {
                    const vals = insight.sparkline!;
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const range = max - min || 1;
                    return vals
                      .map((v, idx) => `${idx * (200 / (vals.length - 1))},${44 - ((v - min) / range) * 40 + 2}`)
                      .join(" ");
                  })()}
                  initial={{ pathLength: 0 }}
                  animate={phase >= 1 ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 1, delay: 0.4 }}
                />
              </svg>
            )}

            {/* Co-purchase pairs */}
            {insight.pairs && (
              <div className="flex flex-col gap-2">
                {insight.pairs.map((pair, j) => (
                  <motion.div
                    key={pair.items}
                    className="flex items-center justify-between text-base"
                    initial={{ opacity: 0, x: -10 }}
                    animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                    transition={{ duration: 0.4, delay: 0.4 + j * 0.1 }}
                  >
                    <span className="font-medium text-[var(--text-primary)]">{pair.items}</span>
                    <span className="font-bold text-[var(--agent-orchestrator)]">{pair.pct}%</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Performance badge */}
      <motion.div
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className="text-base font-semibold text-emerald-700">
          Runs in &lt;50ms on 100 orders
        </span>
      </motion.div>
    </motion.div>
  );
}
