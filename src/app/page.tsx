"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Header } from "@/components/header";
import { StoreLogo } from "@/components/store-logo";
import type { StoreSlug } from "@/lib/scrapers/types";

const STORES: StoreSlug[] = ["ah", "jumbo", "lidl", "aldi", "plus", "picnic"];

const FEATURES = [
  {
    title: "Smart Price Comparison",
    description:
      "Compare prices across 6 stores, find the cheapest combination",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="m7 16 4-8 4 4 4-6" />
      </svg>
    ),
  },
  {
    title: "AI Meal Planning",
    description:
      "Get weekly meal plans that fit your budget with real prices",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5Z" />
        <path d="M19 10H5a2 2 0 0 0-2 2v1a8 8 0 0 0 16 0v-1a2 2 0 0 0-2-2Z" />
        <path d="M12 18v4" />
      </svg>
    ),
  },
  {
    title: "Store Locator",
    description:
      "Find the nearest stores and optimize by location",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
];

const STEPS = [
  "We scrape prices weekly from all major Dutch supermarkets",
  "Our optimizer finds the cheapest combination for your shopping list",
  "You save money -- typically 15-25% vs shopping at a single store",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          {/* Gradient background */}
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-light) 0%, var(--background) 50%, var(--surface-muted) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            }}
          />

          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-6xl">
              Find the cheapest groceries across all Dutch supermarkets
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-[var(--text-secondary)] sm:text-lg">
              Compare prices from Albert Heijn, Jumbo, Lidl, Aldi, Plus, and
              Picnic. Save money every week.
            </p>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                href="/meals"
                className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg sm:w-auto"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                }}
              >
                Plan My Meals
              </Link>
              <Link
                href="/products"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
              >
                Compare Prices
              </Link>
            </div>
          </div>
        </section>

        {/* Store badges */}
        <section className="border-y border-[var(--border-light)] bg-[var(--surface)] px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
            {STORES.map((slug) => (
              <StoreLogo key={slug} slug={slug} size="lg" />
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              Everything you need to save on groceries
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <motion.div
                  key={feature.title}
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-light)]">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 flex flex-col gap-8">
              {STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <p className="pt-1 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
