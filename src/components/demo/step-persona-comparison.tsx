"use client";

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface StepPersonaComparisonProps {
  isActive: boolean;
}

interface PersonaData {
  initial: string;
  label: string;
  orderCount: string;
  tenure: string;
  avgSpend: string;
  deliveryDays: string;
  topItems: string[];
}

const FAMILY: PersonaData = {
  initial: "F",
  label: "Family Household",
  orderCount: "100 orders / 2 years",
  tenure: "2 years",
  avgSpend: "Avg EUR 200/week",
  deliveryDays: "Monday deliveries",
  topItems: [
    "Halfvolle melk",
    "Volkoren brood",
    "Eieren",
    "Yoghurt",
    "Kaas",
  ],
};

const STUDENT: PersonaData = {
  initial: "S",
  label: "Student",
  orderCount: "50 orders / 1 year",
  tenure: "1 year",
  avgSpend: "Avg EUR 35/week",
  deliveryDays: "Wed/Fri deliveries",
  topItems: [
    "Pasta",
    "Rijst",
    "Budget brood",
    "Bier",
    "Instant noodles",
  ],
};

function PersonaCard({
  persona,
  phase,
  delay,
}: {
  persona: PersonaData;
  phase: number;
  delay: number;
}) {
  const isVisible = delay === 0 ? phase >= 1 : phase >= 2;

  return (
    <motion.div
      className="flex-1 rounded-2xl bg-[var(--surface)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden"
      initial={{ opacity: 0, y: 30 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: isVisible ? 0 : 0 }}
    >
      {/* Header */}
      <div className="bg-[var(--picnic-red)] px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <span className="text-xl font-bold text-white">
              {persona.initial}
            </span>
          </div>
          <p className="text-lg font-bold text-white">{persona.label}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 flex flex-col gap-2 border-b border-[var(--border)]">
        <p className="text-base text-[var(--text-primary)]">
          {persona.orderCount}
        </p>
        <p className="text-base text-[var(--text-primary)]">
          {persona.avgSpend}
        </p>
        <p className="text-base text-[var(--text-secondary)]">
          {persona.deliveryDays}
        </p>
      </div>

      {/* Top 5 items */}
      <div className="px-6 py-4">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Top 5 items
        </p>
        <div className="flex flex-col gap-2">
          {persona.topItems.map((item, i) => (
            <motion.p
              key={item}
              className="text-base text-[var(--text-primary)]"
              initial={{ opacity: 0, x: -10 }}
              animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              {item}
            </motion.p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function StepPersonaComparison({
  isActive,
}: StepPersonaComparisonProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
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
        Step 2
      </p>
      <h2 className="mb-8 text-center text-5xl font-bold text-[var(--text-primary)]">
        Same Prompt. Different Customer. Different Cart.
      </h2>

      <div className="flex max-w-5xl w-full gap-8">
        <PersonaCard persona={FAMILY} phase={phase} delay={0} />
        <PersonaCard persona={STUDENT} phase={phase} delay={500} />
      </div>

      {/* Shared prompt + comparison text */}
      <motion.div
        className="mt-8 flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="rounded-xl bg-[var(--surface)] px-6 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <p className="text-center text-xl font-medium text-[var(--text-primary)]">
            &quot;Sort this week&apos;s shop, under 60 euro&quot;
          </p>
        </div>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="text-[var(--text-muted)]"
        >
          <path
            d="M7 10L12 15L17 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-lg text-[var(--text-secondary)]">
          Same input, personalized output
        </p>
      </motion.div>
    </motion.div>
  );
}
