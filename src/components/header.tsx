"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-[var(--accent)] px-4 sm:px-6 shadow-sm">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
        <Link href="/" className="text-lg font-bold text-white">
          GroceryOptimizer
        </Link>
      </div>

      {/* Right: nav links */}
      <nav className="flex items-center gap-2">
        <Link
          href="/"
          className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
        >
          Compare
        </Link>
      </nav>
    </header>
  );
}
