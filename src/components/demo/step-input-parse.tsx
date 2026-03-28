"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

interface StepInputParseProps {
  isActive: boolean;
}

const SENTENCE = "Sort this week's shop, lasagna Wednesday, friends Saturday, under 80 euro";

interface Token {
  text: string;
  color: string | null;
  label: string | null;
}

const tokens: Token[] = [
  { text: "Sort this week's shop, ", color: null, label: null },
  { text: "lasagna Wednesday", color: "var(--agent-meal-planner)", label: "meal" },
  { text: ", ", color: null, label: null },
  { text: "friends Saturday", color: "var(--agent-schedule)", label: "event" },
  { text: ", ", color: null, label: null },
  { text: "under 80 euro", color: "var(--agent-budget)", label: "budget" },
];

const structuredBoxes = [
  {
    key: "meals",
    label: "meals[]",
    value: '"lasagna Wednesday"',
    color: "var(--agent-meal-planner)",
    borderClass: "border-violet-300",
    bgClass: "bg-violet-50",
  },
  {
    key: "events",
    label: "guestEvents[]",
    value: '"friends Saturday"',
    color: "var(--agent-schedule)",
    borderClass: "border-sky-300",
    bgClass: "bg-sky-50",
  },
  {
    key: "budget",
    label: "budget",
    value: "EUR 80.00",
    color: "var(--agent-budget)",
    borderClass: "border-amber-300",
    bgClass: "bg-amber-50",
  },
];

export function StepInputParse({ isActive }: StepInputParseProps) {
  const [phase, setPhase] = useState(0);
  // 0: typing, 1: show full text, 2: highlight tokens, 3: show boxes

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    // Phase transitions
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 2200);
    const t3 = setTimeout(() => setPhase(3), 3400);
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Step 1
      </p>
      <h2 className="mb-12 text-center text-5xl font-bold text-[var(--text-primary)]">
        Input Parsing
      </h2>

      {/* Sentence display */}
      <div className="mb-16 max-w-3xl rounded-2xl bg-[var(--surface)] p-8 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-3 w-3 rounded-full bg-[var(--picnic-red)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">User input</span>
        </div>
        <div className="text-2xl leading-relaxed text-[var(--text-primary)]">
          {phase === 0 && (
            <span className="inline-block h-8 w-1 animate-pulse bg-[var(--text-primary)]" />
          )}
          {phase >= 1 && phase < 2 && (
            <TypewriterText text={SENTENCE} />
          )}
          {phase >= 2 && (
            <span>
              {tokens.map((token, i) => (
                <motion.span
                  key={i}
                  initial={token.color ? { backgroundColor: "transparent" } : undefined}
                  animate={
                    token.color
                      ? {
                          backgroundColor: token.color + "22",
                          borderRadius: "6px",
                          padding: "2px 6px",
                        }
                      : undefined
                  }
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  style={
                    token.color
                      ? { borderBottom: `3px solid ${token.color}` }
                      : undefined
                  }
                >
                  {token.text}
                </motion.span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Structured boxes */}
      <AnimatePresence>
        {phase >= 3 && (
          <motion.div
            className="flex gap-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5 }}
          >
            {structuredBoxes.map((box, i) => (
              <motion.div
                key={box.key}
                className={`rounded-2xl border-2 ${box.borderClass} ${box.bgClass} p-6 min-w-[200px]`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
              >
                <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: box.color }}>
                  {box.label}
                </p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{box.value}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      <span className="inline-block h-7 w-0.5 animate-pulse bg-[var(--text-primary)] ml-0.5" />
    </span>
  );
}
