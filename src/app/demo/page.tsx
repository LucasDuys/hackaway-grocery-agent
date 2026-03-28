"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { StepIndicator } from "@/components/demo/step-indicator";
import { StepCustomerProfile } from "@/components/demo/step-customer-profile";
import { StepPersonaComparison } from "@/components/demo/step-persona-comparison";
import { StepInputParse } from "@/components/demo/step-input-parse";
import { StepDataFetch } from "@/components/demo/step-data-fetch";
import { StepAnalysis } from "@/components/demo/step-analysis";
import { StepRecipes } from "@/components/demo/step-recipes";
import { StepAgentDAG } from "@/components/demo/step-agent-dag";
import { StepBudgetConflict } from "@/components/demo/step-budget-conflict";
import { StepCartAssembly } from "@/components/demo/step-cart-assembly";
import { StepCheckout } from "@/components/demo/step-checkout";
import { StepSummary } from "@/components/demo/step-summary";

const TOTAL_STEPS = 12; // 0 = title, 1 = customer profile, 2 = persona comparison, 3-10 = content steps, 11 = summary

function TitleSlide({ isActive }: { isActive: boolean }) {
  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--picnic-red)]"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <span className="text-3xl font-bold text-white">WS</span>
      </motion.div>

      <motion.h1
        className="mb-4 text-center text-7xl font-bold text-[var(--text-primary)]"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Weekly Shop Agent
      </motion.h1>

      <motion.p
        className="mb-8 text-center text-2xl text-[var(--text-secondary)]"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        Multi-agent grocery orchestration for Picnic
      </motion.p>

      <motion.div
        className="flex items-center gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <span className="rounded-full bg-[var(--picnic-red-light)] px-4 py-2 text-sm font-semibold text-[var(--picnic-red)]">
          Hackaway 2026
        </span>
        <span className="text-sm text-[var(--text-muted)]">
          Built with OpenClaw primitives
        </span>
      </motion.div>

      <motion.p
        className="mt-16 text-base text-[var(--text-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.4, 1] }}
        transition={{ duration: 2, delay: 1.2, repeat: Infinity, repeatDelay: 2 }}
      >
        Press Space or ArrowRight to begin
      </motion.p>
    </motion.div>
  );
}

const STEP_COMPONENTS = [
  TitleSlide,
  StepCustomerProfile,
  StepPersonaComparison,
  StepInputParse,
  StepDataFetch,
  StepAnalysis,
  StepRecipes,
  StepAgentDAG,
  StepBudgetConflict,
  StepCartAssembly,
  StepCheckout,
  StepSummary,
];

export default function DemoPage() {
  const [step, setStep] = useState(0);

  const navigate = useCallback((direction: "next" | "prev" | number) => {
    if (typeof direction === "number") {
      setStep(direction);
    } else if (direction === "next") {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    } else {
      setStep((s) => Math.max(s - 1, 0));
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        navigate("next");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate("prev");
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        navigate(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const CurrentStep = STEP_COMPONENTS[step];

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[var(--background)]"
      tabIndex={0}
    >
      <AnimatePresence mode="wait">
        <CurrentStep key={step} isActive={true} />
      </AnimatePresence>

      {/* Prev / Next buttons */}
      {step > 0 && (
        <button
          onClick={() => navigate("prev")}
          className="fixed bottom-8 left-8 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] shadow-[0_1px_4px_rgba(0,0,0,0.08)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Previous step"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {step < TOTAL_STEPS - 1 && (
        <button
          onClick={() => navigate("next")}
          className="fixed bottom-8 right-8 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] shadow-[0_1px_4px_rgba(0,0,0,0.08)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Next step"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Step indicator */}
      <StepIndicator current={step} total={TOTAL_STEPS} onNavigate={(s) => navigate(s)} />
    </div>
  );
}
