"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepDataFetchProps {
  isActive: boolean;
}

const apiCalls = [
  { endpoint: "GET /orders", label: "100 orders", icon: "O" },
  { endpoint: "GET /products", label: "499 products", icon: "P" },
  { endpoint: "GET /delivery-slots", label: "6 delivery slots", icon: "S" },
  { endpoint: "GET /recipes", label: "5 recipes", icon: "R" },
];

export function StepDataFetch({ isActive }: StepDataFetchProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1600);
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
        Step 2
      </p>
      <h2 className="mb-16 text-center text-5xl font-bold text-[var(--text-primary)]">
        Data Fetch
      </h2>

      <div className="flex items-center gap-16">
        {/* Source */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--surface)] shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <span className="text-2xl font-bold text-[var(--text-primary)]">HA</span>
          </div>
          <span className="text-sm font-medium text-[var(--text-secondary)]">hackaway</span>
        </motion.div>

        {/* Arrows area */}
        <div className="relative flex flex-col gap-4">
          <svg width="200" height="180" viewBox="0 0 200 180">
            {apiCalls.map((call, i) => {
              const y = 20 + i * 42;
              return (
                <g key={call.endpoint}>
                  <motion.line
                    x1="0"
                    y1={y}
                    x2="200"
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    animate={phase >= 1 ? { pathLength: 1 } : { pathLength: 0 }}
                    transition={{ duration: 0.6, delay: i * 0.2 }}
                  />
                  <motion.polygon
                    points={`192,${y - 5} 200,${y} 192,${y + 5}`}
                    fill="var(--text-muted)"
                    initial={{ opacity: 0 }}
                    animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.2 }}
                  />
                  <motion.text
                    x="100"
                    y={y - 8}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="11"
                    fontFamily="monospace"
                    initial={{ opacity: 0 }}
                    animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + i * 0.2 }}
                  >
                    {call.endpoint}
                  </motion.text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Picnic API + cards */}
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--picnic-red)] shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="text-2xl font-bold text-white">P</span>
          </motion.div>
          <span className="text-sm font-medium text-[var(--text-secondary)]">Picnic API</span>

          <div className="mt-2 flex flex-col gap-3">
            {apiCalls.map((call, i) => (
              <motion.div
                key={call.label}
                className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-5 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
                initial={{ opacity: 0, x: 40 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.2 }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-muted)]">
                  <span className="text-sm font-bold text-[var(--text-secondary)]">{call.icon}</span>
                </div>
                <span className="text-base font-semibold text-[var(--text-primary)]">{call.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <motion.p
        className="mt-12 text-lg font-medium text-[var(--text-secondary)]"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        All fetched in parallel (2.3 seconds)
      </motion.p>
    </motion.div>
  );
}
