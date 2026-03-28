"use client";

import Link from "next/link";

interface HeaderProps {
  isTransparencyMode: boolean;
  onToggleMode: () => void;
  pipelineStatus?: string;
  pipelineMode?: "auto" | "custom" | null;
  demoMode?: boolean;
  onToggleDemo?: () => void;
}

export function Header({
  isTransparencyMode,
  onToggleMode,
  pipelineStatus,
  pipelineMode,
  demoMode,
  onToggleDemo,
}: HeaderProps) {
  return (
    <header className="flex h-12 sm:h-14 shrink-0 items-center justify-between bg-[var(--picnic-red)] px-3 sm:px-5 shadow-sm">
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
        <span className="text-base sm:text-lg font-bold text-white">
          Weekly Shop
        </span>
        <Link
          href="/demo"
          className="hidden sm:inline-block ml-2 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
        >
          Demo
        </Link>
      </div>

      {/* Center: Status indicator (compact on mobile) */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {pipelineStatus && (
          <span className="flex items-center gap-1.5 text-xs text-white/90">
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                pipelineStatus === "Agents working..."
                  ? "animate-pulse bg-yellow-300"
                  : pipelineStatus === "Pipeline complete"
                    ? "bg-green-300"
                    : "bg-white/60"
              }`}
            />
            <span className="hidden sm:inline">{pipelineStatus}</span>
          </span>
        )}
        {onToggleDemo && (
          <button
            onClick={onToggleDemo}
            className={`rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium transition-colors ${
              demoMode
                ? "bg-yellow-300 text-yellow-900"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {demoMode ? "Demo" : "Live"}
          </button>
        )}
      </div>

      {/* Right: Agent view toggle (icon only on mobile) */}
      <button
        onClick={onToggleMode}
        className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-white/25"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          {isTransparencyMode ? (
            <>
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <>
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </>
          )}
        </svg>
        <span className="hidden sm:inline">
          {isTransparencyMode ? "Agent View" : "Cart Only"}
        </span>
      </button>
    </header>
  );
}
