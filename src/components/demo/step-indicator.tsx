"use client";

import { motion } from "motion/react";

interface StepIndicatorProps {
  current: number;
  total: number;
  onNavigate: (step: number) => void;
}

export function StepIndicator({ current, total, onNavigate }: StepIndicatorProps) {
  return (
    <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onNavigate(i)}
          className="relative flex h-6 w-6 items-center justify-center"
          aria-label={`Go to step ${i}`}
        >
          <motion.div
            className="rounded-full"
            animate={{
              width: i === current ? 12 : 8,
              height: i === current ? 12 : 8,
              backgroundColor: i === current ? "var(--picnic-red)" : "var(--border)",
            }}
            transition={{ duration: 0.3 }}
          />
        </button>
      ))}
    </div>
  );
}
